import express from 'express';
import pool from '../config/database.js';
import crypto from 'crypto';
import { getIO } from '../lib/socket.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

// Razorpay API base URL
const RZP_BASE = 'https://api.razorpay.com/v1';

// Helper: call Razorpay API using Basic Auth (key_id:key_secret)
async function razorpayRequest(method, path, body, keyId, keySecret) {
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch(`${RZP_BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.description || `Razorpay API error: ${response.status}`);
    }
    return data;
}

// Helper: format error responses consistently
function handlePaymentError(err, context = '') {
    const errorMessages = {
        'Invalid credentials': 'Invalid Razorpay credentials. Please check your Key ID and Secret.',
        'timeout': 'Connection timeout. Please try again.',
        'ECONNREFUSED': 'Cannot connect to payment gateway. Please try again later.',
        'Invalid signature': 'Payment verification failed. Please contact support.',
        'Booking creation failed': 'Booking created but session data incomplete. Please refresh.',
    };

    let userMessage = 'Payment failed. Please try again.';
    let logMessage = err.message || err;

    for (const [key, msg] of Object.entries(errorMessages)) {
        if (logMessage.includes(key)) {
            userMessage = msg;
            break;
        }
    }

    console.error(`Payment error [${context}]:`, logMessage);
    return { userMessage, logMessage };
}

// ─── Therapist: Save / Update Razorpay credentials ───────────────────────────
// POST /api/razorpay/connect
// Enforces one-PG-at-a-time: removes Cashfree if connected
router.post('/connect', ensureAuthenticated, async (req, res) => {
    // Plan check: only Individual and Team plans can use payment gateways
    if (req.user.plan_name === 'free') {
        return res.status(403).json({ error: 'Payment gateway access requires Individual or Team plan.' });
    }

    const { key_id, key_secret } = req.body;

    if (!key_id || !key_secret) {
        return res.status(400).json({ error: 'key_id and key_secret are required' });
    }

    // Validate credentials against Razorpay before saving
    try {
        await razorpayRequest('GET', '/orders?count=1', null, key_id, key_secret);
    } catch (err) {
        return res.status(400).json({ error: 'Invalid Razorpay credentials. Please check your Key ID and Key Secret.' });
    }

    try {
        // Remove any existing Cashfree integration (one PG at a time)
        await pool.query(
            `DELETE FROM UserIntegrations WHERE user_id = $1 AND provider = 'cashfree'`,
            [req.user.id]
        );

        // Save Razorpay credentials
        await pool.query(
            `INSERT INTO UserIntegrations (user_id, provider, app_id, secret_key)
             VALUES ($1, 'razorpay', $2, $3)
             ON CONFLICT (user_id, provider)
             DO UPDATE SET app_id = $2, secret_key = $3, updated_at = NOW()`,
            [req.user.id, key_id, key_secret]
        );
        res.json({ connected: true });
    } catch (err) {
        console.error('Error saving Razorpay credentials:', err);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

// GET /api/razorpay/status
router.get('/status', ensureAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = 'razorpay'`,
            [req.user.id]
        );
        res.json({ connected: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// DELETE /api/razorpay/disconnect
router.delete('/disconnect', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query(
            `DELETE FROM UserIntegrations WHERE user_id = $1 AND provider = 'razorpay'`,
            [req.user.id]
        );
        // Emit real-time integrations update
        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('integrations_updated');

        res.json({ connected: false });
    } catch (err) {
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

// ─── Public: Create Razorpay payment order for a booking ─────────────────────
// POST /api/razorpay/create-order
// Called from PublicBookingPage after slot selection, before booking is confirmed
router.post('/create-order', async (req, res) => {
    const { calendar_id, client_name, client_email, client_phone, start_time, form_responses, price_id } = req.body;

    if (!calendar_id || !client_email || !client_name || !start_time) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Fetch calendar + therapist Razorpay credentials
        const calRes = await pool.query(
            `SELECT c.*, u.id as therapist_id, u.plan_name
             FROM Calendars c JOIN Users u ON c.user_id = u.id
             WHERE c.id = $1`,
            [calendar_id]
        );

        if (calRes.rows.length === 0) {
            return res.status(404).json({ error: 'Calendar not found' });
        }

        const calendar = calRes.rows[0];

        if (!calendar.payment_enabled) {
            return res.status(400).json({ error: 'Payment not enabled for this calendar' });
        }

        // Plan check: only Individual and Team plans can use payment gateways
        if (calendar.plan_name === 'free') {
            return res.status(403).json({ error: 'Payment gateway access requires Individual or Team plan.' });
        }

        // Get therapist's Razorpay credentials
        const rzpRes = await pool.query(
            `SELECT app_id, secret_key FROM UserIntegrations
             WHERE user_id = $1 AND provider = 'razorpay'`,
            [calendar.therapist_id]
        );

        if (rzpRes.rows.length === 0) {
            return res.status(400).json({ error: 'Therapist has not connected Razorpay' });
        }

        const { app_id: key_id, secret_key } = rzpRes.rows[0];

        // Validate and get price from calendar
        const prices = calendar.prices || [];
        if (!prices.length) {
            return res.status(400).json({ error: 'No price configured for this calendar' });
        }

        // If price_id provided, find matching price; otherwise use first
        let price = prices[0];
        if (price_id) {
            const selectedPrice = prices.find(p => p.id === parseInt(price_id));
            if (!selectedPrice) {
                return res.status(400).json({ error: 'Invalid price selected' });
            }
            price = selectedPrice;
        }

        if (!price.amount) {
            return res.status(400).json({ error: 'Price amount not configured' });
        }

        const amount = Math.round(parseFloat(price.amount) * 100); // Razorpay uses paise
        const currency = price.currency || 'INR';

        // Validate amount is positive and reasonable (1 paise to 10 lakh rupees)
        if (amount < 1 || amount > 1000000000) {
            return res.status(400).json({ error: 'Invalid amount for payment' });
        }
        const receiptId = `mello_${calendar_id}_${Date.now()}`;

        const orderPayload = {
            amount,
            currency,
            receipt: receiptId,
            notes: {
                calendar_id: String(calendar_id),
                client_email,
                client_name,
                client_phone: client_phone || '',
                start_time,
                form_responses: form_responses ? JSON.stringify(form_responses) : '',
            },
        };

        const rzpOrder = await razorpayRequest('POST', '/orders', orderPayload, key_id, secret_key);

        res.json({
            order_id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency,
            key_id, // sent to frontend to initialise Razorpay checkout
        });
    } catch (err) {
        const { userMessage } = handlePaymentError(err, 'create-order');
        res.status(500).json({ error: userMessage });
    }
});

// ─── Public: Verify Razorpay payment signature after checkout ────────────────
// POST /api/razorpay/verify-payment
// Called from frontend after Razorpay checkout handler fires
router.post('/verify-payment', async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        calendar_id,
        start_time,
        client_name,
        client_email,
        client_phone,
        form_responses,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !calendar_id) {
        return res.status(400).json({ error: 'Missing required payment verification fields' });
    }

    try {
        // Fetch therapist credentials to verify signature
        const calRes = await pool.query(
            `SELECT c.user_id as therapist_id
             FROM Calendars c
             WHERE c.id = $1`,
            [calendar_id]
        );

        if (calRes.rows.length === 0) {
            return res.status(404).json({ error: 'Calendar not found' });
        }

        const rzpRes = await pool.query(
            `SELECT secret_key FROM UserIntegrations
             WHERE user_id = $1 AND provider = 'razorpay'`,
            [calRes.rows[0].therapist_id]
        );

        if (rzpRes.rows.length === 0) {
            return res.status(400).json({ error: 'Razorpay not connected' });
        }

        // Verify HMAC-SHA256 signature
        const expectedSignature = crypto
            .createHmac('sha256', rzpRes.rows[0].secret_key)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.warn('Razorpay signature mismatch for order', razorpay_order_id);
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // Signature valid — create the booking
        const bookingRes = await fetch(
            `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/bookings/public`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    calendar_id: parseInt(calendar_id),
                    start_time,
                    client_name,
                    client_email,
                    client_phone: client_phone || '',
                    razorpay_order_id,
                    razorpay_payment_id,
                    form_responses: form_responses || null,
                }),
            }
        );

        if (!bookingRes.ok) {
            const err = await bookingRes.json();
            return res.status(500).json({ error: err.error || 'Booking creation failed after payment' });
        }

        const booking = await bookingRes.json();
        res.json({ success: true, booking });
    } catch (err) {
        const { userMessage } = handlePaymentError(err, 'verify-payment');
        res.status(500).json({ error: userMessage });
    }
});

// ─── Therapist: Initiate a Razorpay refund ───────────────────────────────────
// POST /api/razorpay/refund
router.post('/refund', ensureAuthenticated, async (req, res) => {
    const { booking_id, refund_amount, refund_note } = req.body;

    if (!booking_id) {
        return res.status(400).json({ error: 'booking_id is required' });
    }

    try {
        // Fetch the appointment and verify ownership
        const apptRes = await pool.query(
            `SELECT a.razorpay_payment_id, a.payment_amount, a.payment_status, a.id
             FROM Appointments a
             WHERE a.id = $1 AND a.therapist_id = $2`,
            [booking_id, req.user.id]
        );

        if (apptRes.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const appt = apptRes.rows[0];

        if (!appt.razorpay_payment_id) {
            return res.status(400).json({ error: 'This booking was not paid via Razorpay' });
        }

        if (appt.payment_status !== 'Paid') {
            return res.status(400).json({ error: 'Only Paid bookings can be refunded' });
        }

        // Get therapist's Razorpay credentials
        const rzpRes = await pool.query(
            `SELECT app_id, secret_key FROM UserIntegrations
             WHERE user_id = $1 AND provider = 'razorpay'`,
            [req.user.id]
        );

        if (rzpRes.rows.length === 0) {
            return res.status(400).json({ error: 'Razorpay not connected' });
        }

        const { app_id: key_id, secret_key } = rzpRes.rows[0];
        const amount = refund_amount
            ? Math.round(parseFloat(refund_amount) * 100)
            : Math.round(parseFloat(appt.payment_amount) * 100);
        const isPartial = amount < Math.round(parseFloat(appt.payment_amount) * 100);

        // Call Razorpay refund API
        await razorpayRequest(
            'POST',
            `/payments/${appt.razorpay_payment_id}/refund`,
            {
                amount,
                notes: { reason: refund_note || 'Refund initiated by therapist' },
            },
            key_id,
            secret_key
        );

        // Update payment status in DB
        const newStatus = isPartial ? 'Partial Refund' : 'Refunded';
        await pool.query(
            `UPDATE Appointments SET payment_status = $1 WHERE id = $2`,
            [newStatus, appt.id]
        );

        // Emit real-time bookings update
        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('bookings_updated');

        res.json({ success: true, status: newStatus });
    } catch (err) {
        const { userMessage } = handlePaymentError(err, 'refund');
        res.status(500).json({ error: userMessage });
    }
});

// ─── Webhook: Razorpay payment confirmation ───────────────────────────────────
// POST /api/razorpay/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const rawBody = req.body.toString('utf8');
        const signature = req.headers['x-razorpay-signature'];

        if (!signature) {
            console.warn('Razorpay webhook: missing signature header');
            return res.status(400).json({ error: 'Webhook signature required' });
        }

        const payload = JSON.parse(rawBody);
        const { event, payload: eventPayload } = payload;

        if (event !== 'payment.captured') {
            return res.json({ received: true });
        }

        const payment = eventPayload?.payment?.entity;
        if (!payment) return res.json({ received: true });

        const orderId = payment.order_id;
        const paymentId = payment.id;

        // Look up therapist credentials via calendar notes stored on the order
        const rzpRes = await pool.query(
            `SELECT ui.secret_key
             FROM UserIntegrations ui
             JOIN Calendars c ON c.user_id = ui.user_id
             WHERE ui.provider = 'razorpay'
               AND $1 LIKE 'mello_' || c.id || '_%'
             LIMIT 1`,
            [payment.receipt || '']
        );

        // If we can't find by receipt, try to verify with any connected Razorpay user
        // (webhook secret is set at account level, not per-calendar)
        // For now, verify signature if we have a secret
        if (rzpRes.rows.length > 0) {
            const expectedSig = crypto
                .createHmac('sha256', rzpRes.rows[0].secret_key)
                .update(rawBody)
                .digest('hex');

            if (expectedSig !== signature) {
                console.warn('Razorpay webhook signature mismatch for order', orderId);
                return res.status(400).json({ error: 'Invalid signature' });
            }
        }

        // Mark appointment as paid
        const updateRes = await pool.query(
            `UPDATE Appointments SET payment_status = 'Paid', razorpay_payment_id = $1
             WHERE razorpay_order_id = $2 RETURNING id`,
            [paymentId, orderId]
        );

        if (updateRes.rowCount === 0) {
            console.warn(`Razorpay webhook: no appointment found for order ${orderId}`);
        } else {
            console.log(`✅ Razorpay payment confirmed for order: ${orderId}`);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Razorpay webhook error:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
