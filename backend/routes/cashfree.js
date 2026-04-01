import express from 'express';
import pool from '../config/database.js';
import crypto from 'crypto';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

// Cashfree API base URLs
const CF_BASE = {
    sandbox: 'https://sandbox.cashfree.com/pg',
    production: 'https://api.cashfree.com/pg'
};

// Helper: call Cashfree API using the therapist's stored credentials
async function cashfreeRequest(method, path, body, appId, secretKey, environment = 'sandbox') {
    const base = CF_BASE[environment] || CF_BASE.sandbox;
    const response = await fetch(`${base}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-api-version': '2023-08-01',
            'x-client-id': appId,
            'x-client-secret': secretKey,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || `Cashfree API error: ${response.status}`);
    }
    return data;
}

// ─── Therapist: Save / Update Cashfree credentials ───────────────────────────
// POST /api/cashfree/connect
router.post('/connect', ensureAuthenticated, async (req, res) => {
    const { app_id, secret_key, environment = 'sandbox' } = req.body;

    if (!app_id || !secret_key) {
        return res.status(400).json({ error: 'app_id and secret_key are required' });
    }

    // Validate credentials against Cashfree before saving
    try {
        await cashfreeRequest('GET', '/orders?count=1', null, app_id, secret_key, environment);
    } catch (err) {
        return res.status(400).json({ error: 'Invalid Cashfree credentials. Please check your App ID and Secret Key.' });
    }

    try {
        await pool.query(
            `INSERT INTO UserIntegrations (user_id, provider, app_id, secret_key, environment)
             VALUES ($1, 'cashfree', $2, $3, $4)
             ON CONFLICT (user_id, provider)
             DO UPDATE SET app_id = $2, secret_key = $3, environment = $4, updated_at = NOW()`,
            [req.user.id, app_id, secret_key, environment]
        );
        res.json({ connected: true, environment });
    } catch (err) {
        console.error('Error saving Cashfree credentials:', err);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

// GET /api/cashfree/status
router.get('/status', ensureAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT environment FROM UserIntegrations WHERE user_id = $1 AND provider = 'cashfree'`,
            [req.user.id]
        );
        if (result.rows.length === 0) return res.json({ connected: false });
        res.json({ connected: true, environment: result.rows[0].environment });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// DELETE /api/cashfree/disconnect
router.delete('/disconnect', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query(
            `DELETE FROM UserIntegrations WHERE user_id = $1 AND provider = 'cashfree'`,
            [req.user.id]
        );
        res.json({ connected: false });
    } catch (err) {
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

// ─── Public: Create Cashfree payment order for a booking ─────────────────────
// POST /api/cashfree/create-order
// Called from PublicBookingPage after slot selection, before booking is confirmed
router.post('/create-order', async (req, res) => {
    const { calendar_id, client_name, client_email, client_phone, start_time } = req.body;

    if (!calendar_id || !client_email || !client_name || !start_time) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Fetch calendar + therapist Cashfree credentials
        const calRes = await pool.query(
            `SELECT c.*, u.id as therapist_id
             FROM Calendars c JOIN Users u ON c.user_id = u.id
             WHERE c.id = $1 AND c.is_active = true`,
            [calendar_id]
        );

        if (calRes.rows.length === 0) {
            return res.status(404).json({ error: 'Calendar not found' });
        }

        const calendar = calRes.rows[0];

        if (!calendar.payment_enabled) {
            return res.status(400).json({ error: 'Payment not enabled for this calendar' });
        }

        // Get therapist's Cashfree credentials
        const cfRes = await pool.query(
            `SELECT app_id, secret_key, environment FROM UserIntegrations
             WHERE user_id = $1 AND provider = 'cashfree'`,
            [calendar.therapist_id]
        );

        if (cfRes.rows.length === 0) {
            return res.status(400).json({ error: 'Therapist has not connected Cashfree' });
        }

        const { app_id, secret_key, environment } = cfRes.rows[0];

        // Get price from calendar
        const prices = calendar.prices || [];
        const price = prices[0];
        if (!price || !price.amount) {
            return res.status(400).json({ error: 'No price configured for this calendar' });
        }

        const orderId = `mello_${calendar_id}_${Date.now()}`;
        const amount = parseFloat(price.amount);
        const currency = price.currency || 'INR';

        const orderPayload = {
            order_id: orderId,
            order_amount: amount,
            order_currency: currency,
            customer_details: {
                customer_id: `cust_${client_email.replace(/[^a-zA-Z0-9]/g, '_')}`,
                customer_name: client_name,
                customer_email: client_email,
                customer_phone: client_phone || '9999999999',
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/booking-status?order_id={order_id}&calendar_id=${calendar_id}&start_time=${encodeURIComponent(start_time)}&client_name=${encodeURIComponent(client_name)}&client_email=${encodeURIComponent(client_email)}&client_phone=${encodeURIComponent(client_phone || '')}`,
                notify_url: `${process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace('3000', '3001')}/api/cashfree/webhook`,
            },
            order_note: `Booking: ${calendar.title}`,
        };

        const cfOrder = await cashfreeRequest('POST', '/orders', orderPayload, app_id, secret_key, environment);

        res.json({
            order_id: cfOrder.order_id,
            payment_session_id: cfOrder.payment_session_id,
            order_status: cfOrder.order_status,
            environment,
        });
    } catch (err) {
        console.error('Error creating Cashfree order:', err);
        res.status(500).json({ error: err.message || 'Failed to create payment order' });
    }
});

// ─── Webhook: Cashfree payment confirmation ───────────────────────────────────
// POST /api/cashfree/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const rawBody = req.body.toString('utf8');
        const payload = JSON.parse(rawBody);

        const { type, data } = payload;

        if (type !== 'PAYMENT_SUCCESS_WEBHOOK') {
            return res.json({ received: true });
        }

        const orderId = data?.order?.order_id;
        const paymentStatus = data?.payment?.payment_status;

        if (!orderId || paymentStatus !== 'SUCCESS') {
            return res.json({ received: true });
        }

        // Always verify signature when headers are present
        const timestamp = req.headers['x-webhook-timestamp'];
        const signature = req.headers['x-webhook-signature'];

        if (timestamp && signature) {
            // Look up therapist credentials by order ID prefix (mello_<calendarId>_<ts>)
            const cfRes = await pool.query(
                `SELECT ui.secret_key
                 FROM UserIntegrations ui
                 JOIN Calendars c ON c.user_id = ui.user_id
                 WHERE ui.provider = 'cashfree'
                   AND $1 LIKE 'mello_' || c.id || '_%'
                 LIMIT 1`,
                [orderId]
            );

            if (cfRes.rows.length === 0) {
                // Can't verify — reject to be safe
                console.warn('Cashfree webhook: no credentials found for order', orderId);
                return res.status(400).json({ error: 'Cannot verify webhook signature' });
            }

            const expectedSig = crypto
                .createHmac('sha256', cfRes.rows[0].secret_key)
                .update(timestamp + rawBody)
                .digest('base64');

            if (expectedSig !== signature) {
                console.warn('Cashfree webhook signature mismatch for order', orderId);
                return res.status(400).json({ error: 'Invalid signature' });
            }
        } else {
            // No signature headers — only allow in sandbox/dev, reject in production
            if (process.env.NODE_ENV === 'production') {
                console.warn('Cashfree webhook: missing signature headers in production for order', orderId);
                return res.status(400).json({ error: 'Webhook signature required in production' });
            }
            console.warn('Cashfree webhook: no signature headers (sandbox mode), processing anyway');
        }

        // Mark appointment as paid
        await pool.query(
            `UPDATE Appointments SET payment_status = 'Paid' WHERE cashfree_order_id = $1`,
            [orderId]
        );

        console.log(`✅ Payment confirmed for order: ${orderId}`);
        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
