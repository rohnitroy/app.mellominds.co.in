import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../config/database.js';
import { getIO } from '../lib/socket.js';
import { sendEmail } from '../lib/email.js';
import { logAuditEvent } from '../lib/audit.js';

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';

// Throttle subscription creation so nobody can spam our Razorpay account
const subscribeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isProduction ? 5 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a minute and try again.' },
});

// Days a user keeps their plan after a renewal payment starts failing
const GRACE_DAYS = 7;

// Send a plan/billing email (best-effort, never blocks the caller)
async function sendPlanEmail(userId, subject, bodyHtml) {
    try {
        const r = await pool.query('SELECT email, user_name FROM users WHERE id = $1', [userId]);
        const u = r.rows[0];
        if (!u?.email) return;
        const html = `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;padding:32px;">
            <div style="background:#082421;border-radius:12px 12px 0 0;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:22px;">MelloMinds</h1>
            </div>
            <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
                <p style="color:#333;font-size:15px;">Hi <strong>${u.user_name || 'there'}</strong>,</p>
                ${bodyHtml}
                <p style="color:#888;font-size:13px;margin-top:32px;">— The MelloMinds Team</p>
            </div>
        </div>`;
        await sendEmail({ to: u.email, subject, html });
    } catch (e) {
        console.error('sendPlanEmail error:', e.message);
    }
}

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

const RZP_BASE = 'https://api.razorpay.com/v1';

// Platform (MelloMinds own) Razorpay credentials — used to bill therapists for plans.
// Distinct from each therapist's own keys (which collect client payments).
const PLATFORM_KEY_ID = process.env.RAZORPAY_PLATFORM_KEY_ID;
const PLATFORM_KEY_SECRET = process.env.RAZORPAY_PLATFORM_KEY_SECRET;
const PLATFORM_WEBHOOK_SECRET = process.env.RAZORPAY_PLATFORM_WEBHOOK_SECRET;

const platformConfigured = () => !!(PLATFORM_KEY_ID && PLATFORM_KEY_SECRET);

// Plan pricing. Team is per-seat (subscription quantity = seats).
// Yearly ≈ 20% off 12 monthly payments.
const PLAN_PRICING = {
    individual: { label: 'MelloMinds Individual', perSeat: false, monthlyPaise: 69900,  yearlyPaise: 671000 },
    team:       { label: 'MelloMinds Team (per seat)', perSeat: true,  monthlyPaise: 149900, yearlyPaise: 1439000 },
};
const INTERVALS = ['monthly', 'yearly'];
const TEAM_MIN_SEATS = 3;
const TEAM_MAX_SEATS = 20;

const normInterval = (i) => (i === 'yearly' ? 'yearly' : 'monthly');
const unitAmountPaise = (cfg, interval) => (normInterval(interval) === 'yearly' ? cfg.yearlyPaise : cfg.monthlyPaise);

// Call the platform Razorpay account via Basic Auth
async function platformRzp(method, path, body) {
    if (!platformConfigured()) throw new Error('Platform Razorpay not configured');
    const credentials = Buffer.from(`${PLATFORM_KEY_ID}:${PLATFORM_KEY_SECRET}`).toString('base64');
    const response = await fetch(`${RZP_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.description || `Razorpay API error: ${response.status}`);
    }
    return data;
}

// ─── Startup: schema + auto-create Razorpay Plans ────────────────────────────
export async function initPlanBilling() {
    try {
        // Columns to track a user's subscription lifecycle
        await pool.query(`
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(64),
                ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20) DEFAULT 'active',
                ADD COLUMN IF NOT EXISTS plan_current_period_end TIMESTAMP,
                ADD COLUMN IF NOT EXISTS grace_until TIMESTAMP,
                ADD COLUMN IF NOT EXISTS gstin VARCHAR(20),
                ADD COLUMN IF NOT EXISTS mandate_status VARCHAR(20),
                ADD COLUMN IF NOT EXISTS plan_interval VARCHAR(10) DEFAULT 'monthly'
        `);
        // Plan billing history — one row per successful charge (subscription invoice).
        // Named plan_invoices to avoid colliding with the existing appointment 'invoices' table.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS plan_invoices (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                razorpay_invoice_id VARCHAR(64) UNIQUE,
                razorpay_payment_id VARCHAR(64),
                razorpay_subscription_id VARCHAR(64),
                plan_name VARCHAR(50),
                seats INT DEFAULT 1,
                amount NUMERIC(10,2),
                status VARCHAR(20),
                invoice_url TEXT,
                period_start TIMESTAMP,
                period_end TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_plan_invoices_user ON plan_invoices(user_id)`);
        await pool.query(`
            ALTER TABLE plan_payments
                ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(64),
                ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(64),
                ADD COLUMN IF NOT EXISTS seats INT DEFAULT 1
        `);
        // Prevent double-logging the same charge (verify + subscription.charged both fire on first payment).
        // Must come AFTER the razorpay_payment_id column exists.
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_plan_payment_rzp ON plan_payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL`);
        // Catalog of auto-created Razorpay Plan IDs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS billing_plans (
                id SERIAL PRIMARY KEY,
                plan_key VARCHAR(50) NOT NULL,
                razorpay_plan_id VARCHAR(64) NOT NULL,
                amount_paise INT NOT NULL,
                billing_interval VARCHAR(10) DEFAULT 'monthly',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        // Move billing_plans to a (plan_key, interval) key so monthly + yearly can coexist
        await pool.query(`ALTER TABLE billing_plans ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(10) DEFAULT 'monthly'`);
        await pool.query(`ALTER TABLE billing_plans DROP CONSTRAINT IF EXISTS billing_plans_plan_key_key`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_billing_plan_key_interval ON billing_plans(plan_key, billing_interval)`);
        // Idempotency ledger — every Razorpay webhook event processed exactly once
        await pool.query(`
            CREATE TABLE IF NOT EXISTS webhook_events (
                event_id VARCHAR(80) PRIMARY KEY,
                event_type VARCHAR(80),
                processed_at TIMESTAMP DEFAULT NOW()
            )
        `);
        // First-time onboarding flag: new users must pick a plan before using the app.
        // Backfill existing users to 'selected' only when the column is first created.
        const colCheck = await pool.query(
            `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'plan_selected'`
        );
        if (colCheck.rows.length === 0) {
            await pool.query(`ALTER TABLE users ADD COLUMN plan_selected BOOLEAN DEFAULT false`);
            await pool.query(`UPDATE users SET plan_selected = true`); // existing users are grandfathered
        }
        console.log('✅ Plan billing schema verified');

        if (!platformConfigured()) {
            console.warn('⚠️  Platform Razorpay keys missing — plan subscriptions disabled until set');
            return;
        }

        // Create/refresh a Razorpay Plan per (plan, interval). If the configured price
        // changed, a new Razorpay plan is created and the catalog row is updated
        // (existing subscribers keep their original plan; new ones use the new price).
        for (const [planKey, cfg] of Object.entries(PLAN_PRICING)) {
            for (const interval of INTERVALS) {
                const amount = unitAmountPaise(cfg, interval);
                const existing = await pool.query(
                    'SELECT razorpay_plan_id, amount_paise FROM billing_plans WHERE plan_key = $1 AND billing_interval = $2',
                    [planKey, interval]
                );
                if (existing.rows.length > 0 && existing.rows[0].amount_paise === amount) continue;
                const plan = await platformRzp('POST', '/plans', {
                    period: interval === 'yearly' ? 'yearly' : 'monthly',
                    interval: 1,
                    item: { name: `${cfg.label} (${interval})`, amount, currency: 'INR' },
                });
                await pool.query(
                    `INSERT INTO billing_plans (plan_key, razorpay_plan_id, amount_paise, billing_interval)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (plan_key, billing_interval)
                     DO UPDATE SET razorpay_plan_id = EXCLUDED.razorpay_plan_id, amount_paise = EXCLUDED.amount_paise`,
                    [planKey, plan.id, amount, interval]
                );
                console.log(`✅ Razorpay plan set for '${planKey}' (${interval}) @ ₹${amount / 100}: ${plan.id}`);
            }
        }
    } catch (err) {
        console.error('⚠️  Plan billing init warning:', err.message);
    }
}

async function getRazorpayPlanId(planKey, interval) {
    const r = await pool.query(
        'SELECT razorpay_plan_id FROM billing_plans WHERE plan_key = $1 AND billing_interval = $2',
        [planKey, normInterval(interval)]
    );
    return r.rows[0]?.razorpay_plan_id || null;
}

// ─── Create a subscription (returns subscription_id for checkout) ─────────────
// POST /api/plan/create-subscription { plan_key, seats }
router.post('/create-subscription', subscribeLimiter, ensureAuthenticated, async (req, res) => {
    try {
        if (!platformConfigured()) return res.status(503).json({ error: 'Plan billing not available yet.' });
        const { plan_key, seats } = req.body;
        const interval = normInterval(req.body.interval);
        const cfg = PLAN_PRICING[plan_key];
        if (!cfg) return res.status(400).json({ error: 'Invalid plan' });

        let quantity = 1;
        if (cfg.perSeat) {
            quantity = parseInt(seats) || TEAM_MIN_SEATS;
            if (quantity < TEAM_MIN_SEATS || quantity > TEAM_MAX_SEATS) {
                return res.status(400).json({ error: `Team seats must be between ${TEAM_MIN_SEATS} and ${TEAM_MAX_SEATS}` });
            }
        }

        const planId = await getRazorpayPlanId(plan_key, interval);
        if (!planId) return res.status(503).json({ error: 'Plan not provisioned yet. Try again shortly.' });

        // Switch-aware: prevent duplicate subscriptions. Look at the user's current state.
        const meRes = await pool.query(
            'SELECT plan_name, plan_status, subscription_id FROM users WHERE id = $1',
            [req.user.id]
        );
        const me = meRes.rows[0] || {};
        const hasActiveSub = me.subscription_id && ['active', 'cancelling', 'past_due', 'pending'].includes(me.plan_status);

        if (hasActiveSub) {
            // Same plan already → no new subscription (seat changes go through update-seats)
            if (me.plan_name === plan_key) {
                return res.status(400).json({ error: 'You are already on this plan. Use seat update to change seats.' });
            }
            // Different tier → cancel the old subscription immediately so it never double-charges
            try {
                await platformRzp('POST', `/subscriptions/${me.subscription_id}/cancel`, { cancel_at_cycle_end: 0 });
            } catch (e) {
                console.warn('Could not cancel previous subscription before switch:', e.message);
            }
        }

        const subscription = await platformRzp('POST', '/subscriptions', {
            plan_id: planId,
            // 10 years worth of cycles either way
            total_count: interval === 'yearly' ? 10 : 120,
            quantity,
            customer_notify: 1,
            // Razorpay auto-cancels the subscription if not authorized/paid within 30 min
            expire_by: Math.floor(Date.now() / 1000) + 30 * 60,
            notes: { user_id: String(req.user.id), plan_key, interval },
        });

        // Store as pending until payment is verified
        await pool.query(
            `UPDATE users SET subscription_id = $1, plan_status = 'pending', plan_interval = $2 WHERE id = $3`,
            [subscription.id, interval, req.user.id]
        );

        res.json({
            subscription_id: subscription.id,
            key_id: PLATFORM_KEY_ID,
            plan_key,
            interval,
            seats: quantity,
            amount_paise: unitAmountPaise(cfg, interval) * quantity,
        });
    } catch (err) {
        console.error('create-subscription error:', err.message);
        res.status(500).json({ error: 'Failed to start subscription. Please try again.' });
    }
});

// ─── Verify first payment → activate plan ────────────────────────────────────
// POST /api/plan/verify { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan_key, seats }
router.post('/verify', ensureAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan_key, seats } = req.body;
        const interval = normInterval(req.body.interval);
        const cfg = PLAN_PRICING[plan_key];
        if (!cfg || !razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment details' });
        }

        // Razorpay subscription signature = HMAC_SHA256(payment_id + '|' + subscription_id, key_secret)
        const expected = crypto
            .createHmac('sha256', PLATFORM_KEY_SECRET)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest('hex');
        if (expected !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        const quantity = cfg.perSeat ? Math.max(TEAM_MIN_SEATS, Math.min(TEAM_MAX_SEATS, parseInt(seats) || TEAM_MIN_SEATS)) : 1;
        const amount = (unitAmountPaise(cfg, interval) * quantity) / 100;
        const pgInterval = interval === 'yearly' ? '1 year' : '1 month';

        await client.query('BEGIN');
        await client.query(
            `UPDATE users
             SET plan_name = $1, purchased_seats = $2, subscription_id = $3,
                 plan_status = 'active', plan_current_period_end = NOW() + ($5)::interval,
                 plan_interval = $6, plan_selected = true
             WHERE id = $4`,
            [plan_key, quantity, razorpay_subscription_id, req.user.id, pgInterval, interval]
        );
        await client.query(
            `INSERT INTO plan_payments (user_id, plan_name, amount, payment_status, payment_method, razorpay_subscription_id, razorpay_payment_id, seats)
             VALUES ($1, $2, $3, 'Paid', 'Razorpay', $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [req.user.id, plan_key, amount, razorpay_subscription_id, razorpay_payment_id, quantity]
        );
        await client.query('COMMIT');

        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('plan_updated', { plan_name: plan_key, seats: quantity });

        logAuditEvent({ userId: req.user.id, action: 'plan_subscribed', resourceType: 'subscription', resourceId: razorpay_subscription_id, ipAddress: req.ip, details: { plan_key, seats: quantity, amount } });

        sendPlanEmail(
            req.user.id,
            `Welcome to MelloMinds ${cfg.label.includes('Team') ? 'Team' : 'Individual'}!`,
            `<p style="color:#333;font-size:15px;">Your <strong>${plan_key === 'team' ? `Team plan (${quantity} seats)` : 'Individual plan'}</strong> is now active.</p>
             <p style="color:#333;font-size:15px;">You were charged <strong>₹${amount.toLocaleString('en-IN')}</strong>. It renews automatically each month — you can manage or cancel anytime in Settings.</p>`
        );

        res.json({ success: true, plan_name: plan_key, seats: quantity });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('plan verify error:', err.message);
        res.status(500).json({ error: 'Failed to activate plan' });
    } finally {
        client.release();
    }
});

// ─── Onboarding: user picks the Free plan ────────────────────────────────────
// POST /api/plan/select-free
router.post('/select-free', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query(
            `UPDATE users SET plan_selected = true WHERE id = $1`,
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('select-free error:', err.message);
        res.status(500).json({ error: 'Failed to select plan' });
    }
});

// ─── Current subscription status ─────────────────────────────────────────────
// GET /api/plan/subscription
router.get('/subscription', ensureAuthenticated, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT plan_name, plan_status, purchased_seats, subscription_id, plan_current_period_end, plan_interval, mandate_status
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        res.json(r.rows[0] || {});
    } catch (err) {
        console.error('subscription status error:', err.message);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// ─── Retry / update payment method for a failing subscription ────────────────
// GET /api/plan/retry → data to re-open Razorpay checkout on the existing sub
router.get('/retry', ensureAuthenticated, async (req, res) => {
    try {
        if (!platformConfigured()) return res.status(503).json({ error: 'Plan billing not available' });
        const r = await pool.query(
            'SELECT plan_name, plan_status, subscription_id, purchased_seats, plan_interval FROM users WHERE id = $1',
            [req.user.id]
        );
        const u = r.rows[0];
        if (!u?.subscription_id) return res.status(400).json({ error: 'No subscription to update' });
        if (!PLAN_PRICING[u.plan_name]) return res.status(400).json({ error: 'Not on a paid plan' });
        res.json({
            subscription_id: u.subscription_id,
            key_id: PLATFORM_KEY_ID,
            plan_key: u.plan_name,
            interval: normInterval(u.plan_interval),
            seats: u.purchased_seats || 1,
        });
    } catch (err) {
        console.error('retry endpoint error:', err.message);
        res.status(500).json({ error: 'Failed to start payment update' });
    }
});

// ─── Billing history (invoices) ──────────────────────────────────────────────
// GET /api/plan/invoices
router.get('/invoices', ensureAuthenticated, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, plan_name, seats, amount, status, invoice_url, period_start, period_end, created_at
             FROM plan_invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.json(r.rows);
    } catch (err) {
        console.error('invoices fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// ─── Change Team seat count (proration) ──────────────────────────────────────
// POST /api/plan/update-seats { seats }
router.post('/update-seats', ensureAuthenticated, async (req, res) => {
    try {
        if (!platformConfigured()) return res.status(503).json({ error: 'Plan billing not available' });
        const userRes = await pool.query('SELECT plan_name, subscription_id, org_role FROM users WHERE id = $1', [req.user.id]);
        const u = userRes.rows[0];
        if (!u || u.plan_name !== 'team' || u.org_role === 'member') {
            return res.status(403).json({ error: 'Only team plan owners can change seats' });
        }
        if (!u.subscription_id) return res.status(400).json({ error: 'No active subscription' });

        const seats = parseInt(req.body.seats);
        if (!seats || seats < TEAM_MIN_SEATS || seats > TEAM_MAX_SEATS) {
            return res.status(400).json({ error: `Seats must be between ${TEAM_MIN_SEATS} and ${TEAM_MAX_SEATS}` });
        }

        // Guard: can't drop below seats already in use (owner + active members)
        const usedRes = await pool.query(
            `SELECT COUNT(*) AS members FROM organization_therapists WHERE owner_id = $1 AND status != 'removed'`,
            [req.user.id]
        );
        const usedSeats = 1 + parseInt(usedRes.rows[0].members || 0); // owner + members
        if (seats < usedSeats) {
            return res.status(400).json({ error: `You have ${usedSeats} seats in use. Remove members before reducing seats below ${usedSeats}.` });
        }

        // Apply quantity change immediately with proration
        await platformRzp('PATCH', `/subscriptions/${u.subscription_id}`, {
            quantity: seats,
            schedule_change_at: 'now',
        });
        await pool.query('UPDATE users SET purchased_seats = $1 WHERE id = $2', [seats, req.user.id]);

        logAuditEvent({ userId: req.user.id, action: 'plan_seats_updated', resourceType: 'subscription', resourceId: u.subscription_id, ipAddress: req.ip, details: { seats } });

        res.json({ success: true, seats });
    } catch (err) {
        console.error('update-seats error:', err.message);
        res.status(500).json({ error: 'Failed to update seats' });
    }
});

// ─── Cancel subscription (keeps plan until paid period ends) ─────────────────
// POST /api/plan/cancel
router.post('/cancel', ensureAuthenticated, async (req, res) => {
    try {
        if (!platformConfigured()) return res.status(503).json({ error: 'Plan billing not available' });
        const userRes = await pool.query('SELECT subscription_id FROM users WHERE id = $1', [req.user.id]);
        const subId = userRes.rows[0]?.subscription_id;
        if (!subId) return res.status(400).json({ error: 'No active subscription' });

        // cancel_at_cycle_end = 1 → user keeps plan until the period they paid for ends
        await platformRzp('POST', `/subscriptions/${subId}/cancel`, { cancel_at_cycle_end: 1 });
        await pool.query(`UPDATE users SET plan_status = 'cancelling' WHERE id = $1`, [req.user.id]);

        logAuditEvent({ userId: req.user.id, action: 'plan_cancel_scheduled', resourceType: 'subscription', resourceId: subId, ipAddress: req.ip });

        res.json({ success: true, message: 'Subscription will end at the close of your current billing period.' });
    } catch (err) {
        console.error('plan cancel error:', err.message);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// ─── Webhook: renewals, cancellations, failures ──────────────────────────────
// POST /api/plan/webhook   (raw body — registered before express.json in server.js)
router.post('/webhook', async (req, res) => {
    try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
        const signature = req.headers['x-razorpay-signature'];

        // In production a webhook secret is mandatory — never trust an unsigned event
        if (!PLATFORM_WEBHOOK_SECRET) {
            if (isProduction) {
                console.error('Plan webhook rejected: RAZORPAY_PLATFORM_WEBHOOK_SECRET not set');
                return res.status(503).json({ error: 'Webhook not configured' });
            }
        } else {
            if (!signature) return res.status(400).json({ error: 'Missing signature' });
            const expected = crypto.createHmac('sha256', PLATFORM_WEBHOOK_SECRET).update(rawBody).digest('hex');
            if (expected !== signature) {
                console.warn('Plan webhook signature mismatch');
                return res.status(400).json({ error: 'Invalid signature' });
            }
        }

        const payload = JSON.parse(rawBody);
        const event = payload.event;

        // Idempotency: process each Razorpay event exactly once (webhooks retry)
        const eventId = req.headers['x-razorpay-event-id'] || `${event}:${payload.created_at || ''}:${payload.payload?.subscription?.entity?.id || ''}`;
        const seen = await pool.query(
            `INSERT INTO webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
            [eventId, event]
        );
        if (seen.rowCount === 0) return res.json({ received: true, duplicate: true });

        const sub = payload.payload?.subscription?.entity;
        const invoice = payload.payload?.invoice?.entity;
        const payment = payload.payload?.payment?.entity;
        const subId = sub?.id || invoice?.subscription_id;

        // Always 200 quickly for unrelated events so Razorpay doesn't retry forever
        if (!subId) return res.json({ received: true });

        const userRes = await pool.query('SELECT id, plan_name, plan_interval FROM users WHERE subscription_id = $1', [subId]);
        const user = userRes.rows[0];
        if (!user) return res.json({ received: true });
        const userInterval = normInterval(user.plan_interval);

        switch (event) {
            case 'subscription.charged': {
                // Renewal succeeded — extend period, log payment
                const planKey = user.plan_name;
                const cfg = PLAN_PRICING[planKey];
                const seats = sub?.quantity || 1;
                const amount = cfg ? (unitAmountPaise(cfg, userInterval) * seats) / 100 : (payment?.amount || 0) / 100;
                const pgInterval = userInterval === 'yearly' ? '1 year' : '1 month';
                await pool.query(
                    `UPDATE users SET plan_status = 'active', grace_until = NULL, plan_current_period_end = NOW() + ($2)::interval WHERE id = $1`,
                    [user.id, pgInterval]
                );
                await pool.query(
                    `INSERT INTO plan_payments (user_id, plan_name, amount, payment_status, payment_method, razorpay_subscription_id, razorpay_payment_id, seats)
                     VALUES ($1, $2, $3, 'Paid', 'Razorpay', $4, $5, $6)
                     ON CONFLICT DO NOTHING`,
                    [user.id, planKey, amount, subId, payment?.id || null, seats]
                );
                break;
            }
            case 'invoice.paid': {
                // Store a billing-history row + email a receipt
                const amount = invoice?.amount_paid != null ? invoice.amount_paid / 100 : (payment?.amount || 0) / 100;
                const ins = await pool.query(
                    `INSERT INTO plan_invoices (user_id, razorpay_invoice_id, razorpay_payment_id, razorpay_subscription_id, plan_name, seats, amount, status, invoice_url, period_start, period_end)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,'Paid',$8,$9,$10)
                     ON CONFLICT (razorpay_invoice_id) DO NOTHING
                     RETURNING id`,
                    [
                        user.id, invoice?.id || null, invoice?.payment_id || payment?.id || null, subId,
                        user.plan_name, sub?.quantity || 1, amount, invoice?.short_url || null,
                        invoice?.billing_start ? new Date(invoice.billing_start * 1000) : null,
                        invoice?.billing_end ? new Date(invoice.billing_end * 1000) : null,
                    ]
                );
                if (ins.rowCount > 0) {
                    sendPlanEmail(
                        user.id,
                        'Your MelloMinds payment receipt',
                        `<p style="color:#333;font-size:15px;">We received your payment of <strong>₹${amount.toLocaleString('en-IN')}</strong>.</p>
                         ${invoice?.short_url ? `<p style="color:#333;font-size:15px;"><a href="${invoice.short_url}" style="color:#2D7579;">Download your invoice</a></p>` : ''}`
                    );
                }
                break;
            }
            case 'subscription.authenticated': {
                // Mandate (UPI AutoPay / card / e-NACH) approved by the customer
                await pool.query(`UPDATE users SET mandate_status = 'active' WHERE id = $1`, [user.id]);
                break;
            }
            case 'subscription.activated':
            case 'subscription.resumed': {
                await pool.query(`UPDATE users SET plan_status = 'active', grace_until = NULL WHERE id = $1`, [user.id]);
                break;
            }
            case 'subscription.paused': {
                await pool.query(`UPDATE users SET plan_status = 'paused' WHERE id = $1`, [user.id]);
                break;
            }
            case 'subscription.updated': {
                // Quantity / schedule changed (e.g. seat change) — sync seats + period
                const seats = sub?.quantity;
                const periodEnd = sub?.current_end ? new Date(sub.current_end * 1000) : null;
                await pool.query(
                    `UPDATE users SET purchased_seats = COALESCE($1, purchased_seats), plan_current_period_end = COALESCE($2, plan_current_period_end) WHERE id = $3`,
                    [seats || null, periodEnd, user.id]
                );
                break;
            }
            case 'subscription.halted':
            case 'subscription.cancelled':
            case 'subscription.completed': {
                // Period has ended (we cancel at cycle end) → drop to Free
                await pool.query(
                    `UPDATE users SET plan_name = 'free', plan_status = 'cancelled', subscription_id = NULL, purchased_seats = 0, grace_until = NULL, mandate_status = NULL WHERE id = $1`,
                    [user.id]
                );
                const io = getIO();
                if (io) io.to(`user:${user.id}`).emit('plan_updated', { plan_name: 'free' });
                logAuditEvent({ userId: user.id, action: 'plan_downgraded_free', resourceType: 'subscription', resourceId: subId, details: { event } });
                sendPlanEmail(
                    user.id,
                    'Your MelloMinds subscription has ended',
                    `<p style="color:#333;font-size:15px;">Your plan has ended and your account is now on the <strong>Free</strong> plan. You can re-subscribe anytime from the Pricing page.</p>`
                );
                break;
            }
            case 'payment.failed':
            case 'subscription.pending': {
                // A renewal charge is failing — start a grace window, keep plan for now
                await pool.query(
                    `UPDATE users SET plan_status = 'past_due', grace_until = NOW() + INTERVAL '${GRACE_DAYS} days' WHERE id = $1`,
                    [user.id]
                );
                const io = getIO();
                if (io) io.to(`user:${user.id}`).emit('plan_updated', {});
                sendPlanEmail(
                    user.id,
                    'Action needed: your MelloMinds payment failed',
                    `<p style="color:#333;font-size:15px;">We couldn't process your renewal. We'll retry over the next few days.</p>
                     <p style="color:#333;font-size:15px;">Please update your payment method within <strong>${GRACE_DAYS} days</strong> to keep your plan. Manage it in <strong>Settings → Plan &amp; Billing</strong>.</p>`
                );
                break;
            }
            default:
                break;
        }

        res.json({ received: true });
    } catch (err) {
        console.error('plan webhook error:', err.message);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// ─── Reconciliation: heal DB drift against Razorpay (source of truth) ────────
// Runs hourly. Catches missed webhooks, dashboard edits, failed writes.
export async function reconcileSubscriptions() {
    if (!platformConfigured()) return;
    try {
        const users = await pool.query(
            `SELECT id, plan_name, plan_status, subscription_id, purchased_seats
             FROM users WHERE subscription_id IS NOT NULL`
        );
        for (const u of users.rows) {
            try {
                const sub = await platformRzp('GET', `/subscriptions/${u.subscription_id}`);
                const status = sub.status; // created/authenticated/active/pending/halted/cancelled/completed/expired/paused
                const seats = sub.quantity || u.purchased_seats || 1;
                const periodEnd = sub.current_end ? new Date(sub.current_end * 1000) : null;

                if (['active', 'authenticated'].includes(status)) {
                    // Keep a locally-scheduled cancellation ('cancelling') — don't revert it
                    const nextStatus = u.plan_status === 'cancelling' ? 'cancelling' : 'active';
                    await pool.query(
                        `UPDATE users SET plan_status = $1, purchased_seats = $2, plan_current_period_end = $3 WHERE id = $4`,
                        [nextStatus, seats, periodEnd, u.id]
                    );
                } else if (status === 'pending' || status === 'halted') {
                    await pool.query(`UPDATE users SET plan_status = 'past_due' WHERE id = $1`, [u.id]);
                } else if (['cancelled', 'completed', 'expired'].includes(status)) {
                    // Subscription truly ended → downgrade to Free
                    await pool.query(
                        `UPDATE users SET plan_name = 'free', plan_status = 'cancelled', subscription_id = NULL, purchased_seats = 0 WHERE id = $1`,
                        [u.id]
                    );
                    const io = getIO();
                    if (io) io.to(`user:${u.id}`).emit('plan_updated', { plan_name: 'free' });
                }
            } catch (e) {
                console.warn(`Reconcile failed for user ${u.id} / sub ${u.subscription_id}:`, e.message);
            }
        }
    } catch (err) {
        console.error('reconcileSubscriptions error:', err.message);
    }
}

// Clear subscriptions stuck in 'pending' (checkout started but never paid).
// Razorpay auto-expires them via expire_by; this reflects that in our DB quickly.
export async function sweepPendingSubscriptions() {
    if (!platformConfigured()) return;
    try {
        const rows = await pool.query(
            `SELECT id, subscription_id FROM users WHERE plan_status = 'pending' AND subscription_id IS NOT NULL`
        );
        for (const u of rows.rows) {
            try {
                const sub = await platformRzp('GET', `/subscriptions/${u.subscription_id}`);
                if (['active', 'authenticated'].includes(sub.status)) {
                    // Payment actually went through (verify webhook may have been missed)
                    await pool.query(
                        `UPDATE users SET plan_status = 'active', plan_current_period_end = $1 WHERE id = $2`,
                        [sub.current_end ? new Date(sub.current_end * 1000) : null, u.id]
                    );
                } else if (['cancelled', 'expired', 'completed', 'halted'].includes(sub.status)) {
                    // Abandoned / expired → clear the dangling subscription
                    await pool.query(
                        `UPDATE users SET plan_name = 'free', plan_status = 'active', subscription_id = NULL, purchased_seats = 0 WHERE id = $1`,
                        [u.id]
                    );
                    const io = getIO();
                    if (io) io.to(`user:${u.id}`).emit('plan_updated', {});
                }
                // 'created' → still within the pay window; leave it (expire_by will resolve it)
            } catch (e) {
                console.warn(`Pending sweep failed for user ${u.id}:`, e.message);
            }
        }
    } catch (err) {
        console.error('sweepPendingSubscriptions error:', err.message);
    }
}

export default router;
