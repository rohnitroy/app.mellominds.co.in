import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { createNotification } from '../lib/notifications.js';
import { sendEmail, bookingConfirmationEmail, cancellationEmail, rescheduleConfirmationEmail, isEmailEnabled } from '../lib/email.js';
import { getGoogleAuthClient } from '../lib/googleAuth.js';
import { getIO } from '../lib/socket.js';
import rateLimit from 'express-rate-limit';
import { sanitizeStr, isValidEmail, isValidPhone } from '../middleware/sanitize.js';

const router = express.Router();

// Rate limiter for public booking endpoint
const publicBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please try again later.' },
});

// Middleware to ensure authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// POST /api/bookings/public - Create appointment (Unauthenticated)
router.post('/public', publicBookingLimiter, async (req, res) => {
    const client = await pool.connect();
    try {
        let { calendar_id, start_time, client_email, client_name, client_phone, form_responses, location_type, cashfree_order_id, razorpay_order_id, razorpay_payment_id, partner_name, partner_email, partner_phone } = req.body;

        if (!calendar_id || !start_time || !client_email || !client_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Sanitize and validate inputs
        client_name = sanitizeStr(client_name, 100);
        client_email = client_email.trim().toLowerCase().slice(0, 254);
        client_phone = client_phone ? sanitizeStr(client_phone, 20) : null;
        partner_name = partner_name ? sanitizeStr(partner_name, 100) : null;
        partner_email = partner_email ? partner_email.trim().toLowerCase().slice(0, 254) : null;
        partner_phone = partner_phone ? sanitizeStr(partner_phone, 20) : null;

        if (!isValidEmail(client_email)) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }
        if (client_phone && !isValidPhone(client_phone)) {
            return res.status(400).json({ error: 'Invalid phone number.' });
        }
        if (partner_email && !isValidEmail(partner_email)) {
            return res.status(400).json({ error: 'Invalid partner email address.' });
        }
        if (!client_name) {
            return res.status(400).json({ error: 'Client name is required.' });
        }
        // Limit form_responses size
        if (form_responses && JSON.stringify(form_responses).length > 10000) {
            return res.status(400).json({ error: 'Form responses too large.' });
        }

        // Idempotency: if a booking already exists for this cashfree_order_id, return it directly
        if (cashfree_order_id) {
            const existing = await client.query(
                `SELECT * FROM Appointments WHERE cashfree_order_id = $1 LIMIT 1`,
                [cashfree_order_id]
            );
            if (existing.rows.length > 0) {
                return res.status(200).json(existing.rows[0]);
            }
        }

        // Idempotency: if a booking already exists for this razorpay_order_id, return it directly
        if (razorpay_order_id) {
            const existing = await client.query(
                `SELECT * FROM Appointments WHERE razorpay_order_id = $1 LIMIT 1`,
                [razorpay_order_id]
            );
            if (existing.rows.length > 0) {
                return res.status(200).json(existing.rows[0]);
            }
        }

        await client.query('BEGIN');

        // 1. Fetch Calendar & Therapist Details
        const calendarRes = await client.query(
            `SELECT c.*, u.id as user_id, u.email as therapist_email
             FROM Calendars c 
             JOIN Users u ON c.user_id = u.id 
             WHERE c.id = $1`,
            [calendar_id]
        );

        if (calendarRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Calendar service not found' });
        }

        const calendarService = calendarRes.rows[0];
        const userId = calendarService.user_id; // Therapist ID

        // Check if this client has been transferred away from this therapist
        const transferCheck = await client.query(
            `SELECT ct.id
             FROM ClientTransfers ct
             JOIN Clients c ON ct.client_id = c.id
             WHERE ct.from_therapist_id = $1
               AND LOWER(c.email) = LOWER($2)
               AND ct.status = 'approved'
             LIMIT 1`,
            [userId, client_email]
        );
        if (transferCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: 'Your profile has been transferred to another therapist. Please book through your new therapist\'s booking page.'
            });
        }

        // Require therapist to have Google Calendar connected
        const googleCheck = await client.query(
            "SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
            [userId]
        );
        if (googleCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bookings are currently unavailable. The therapist has not connected their Google Calendar.' });
        }

        // Parse duration
        const durationMatch = calendarService.duration.match(/(\d+)/);
        const durationMinutes = durationMatch ? parseInt(durationMatch[0]) : 60;

        const startTime = new Date(start_time);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // 2. Fetch Google Auth Client (handles token refresh automatically)
        const googleAuthClient = await getGoogleAuthClient(userId);

        let googleEventId = null;
        let meetLink = null;

        if (googleAuthClient) {
            const calendar = google.calendar({ version: 'v3', auth: googleAuthClient });

            const event = {
                summary: `${calendarService.title} with ${client_name}`,
                description: `Booking for ${client_name} (${client_email})${partner_name ? `\nPartner: ${partner_name} (${partner_email})` : ''}\n\n${calendarService.description || ''}`,
                start: { dateTime: startTime.toISOString() },
                end: { dateTime: endTime.toISOString() },
                conferenceData: {
                    createRequest: {
                        requestId: `meet-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                },
                attendees: [
                    { email: client_email },
                    ...(partner_email ? [{ email: partner_email }] : [])
                ]
            };

            try {
                const googleRes = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                    conferenceDataVersion: 1
                });

                googleEventId = googleRes.data.id;
                meetLink = googleRes.data.hangoutLink;
            } catch (gError) {
                console.error('Google Calendar Sync Failed:', gError);
            }
        }

        // 3. Check if payment is required and enforce it
        if (calendarService.payment_enabled) {
            // Validate payment gateway is configured
            if (!calendarService.payment_gateway) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Payment gateway not configured for this calendar' 
                });
            }
            
            // Validate prices are configured
            if (!calendarService.prices?.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'No prices configured for this calendar' 
                });
            }
            
            // For non-offline payments, require payment before booking
            if (calendarService.payment_gateway !== 'offline') {
                // Store pending payment for webhook processing
                const bookingAmount = parseFloat(calendarService.prices[0]?.amount || 0);
                
                await client.query(
                    `INSERT INTO PendingPayments (calendar_id, order_id, gateway, amount, client_email, client_name, client_phone, form_responses, location_type, partner_email, partner_phone, partner_name, start_time)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [calendar_id, `pending-${Date.now()}`, calendarService.payment_gateway, bookingAmount, client_email, client_name, client_phone || null, form_responses ? JSON.stringify(form_responses) : null, location_type || 'google_meet', partner_email || null, partner_phone || null, partner_name || null, startTime]
                );
                
                await client.query('ROLLBACK');
                return res.status(402).json({ 
                    error: 'Payment required',
                    payment_gateway: calendarService.payment_gateway,
                    amount: bookingAmount,
                    currency: calendarService.prices[0]?.currency || 'INR'
                });
            }
        }

        // 4. Create Appointment in DB
        // Use first configured price from calendar if payment is enabled
        const bookingAmount = calendarService.payment_enabled && calendarService.prices?.length
            ? (calendarService.prices[0]?.amount || 0)
            : 0;

        const insertRes = await client.query(
            `INSERT INTO Appointments 
       (therapist_id, calendar_id, title, start_time, end_time, appointment_date, google_event_id, meet_link, client_email, client_name, client_phone, payment_amount, payment_status, form_responses, location_type, cashfree_order_id, razorpay_order_id, razorpay_payment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
            [
                userId,
                calendar_id,
                calendarService.title,
                startTime,
                endTime,
                startTime.toISOString().split('T')[0], // appointment_date as YYYY-MM-DD
                googleEventId,
                meetLink,
                client_email,
                client_name,
                client_phone || null,
                bookingAmount,
                cashfree_order_id ? 'Pending' : 'Pending',
                form_responses ? JSON.stringify(form_responses) : null,
                location_type || 'google_meet',
                cashfree_order_id || null,
                razorpay_order_id || null,
                razorpay_payment_id || null,
            ]
        );

        await client.query('COMMIT');

        // Upsert client into Clients table so they appear in All Clients
        try {
            await client.query(
                `INSERT INTO Clients (therapist_id, name, email, phone)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (therapist_id, email)
                 DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = COALESCE(EXCLUDED.phone, Clients.phone),
                    updated_at = CURRENT_TIMESTAMP`,
                [userId, client_name, client_email.trim().toLowerCase(), client_phone || null]
            );
        } catch (clientErr) {
            // Non-fatal — booking is already committed, just log
            console.error('Failed to upsert client from public booking:', clientErr.message);
        }

        // Notify therapist of new booking (public)
        await createNotification({
            userId,
            type: 'new_booking',
            title: 'New Booking',
            description: `You have received a new booking from ${client_name}`,
            relatedId: insertRes.rows[0].id
        });

        // Real-time: notify therapist's connected clients
        const io = getIO();
        if (io) {
            io.to(`user:${userId}`).emit('bookings_updated');
            io.to(`user:${userId}`).emit('notifications_updated');
        }

        // Send confirmation email to client
        if (await isEmailEnabled(userId, 'booking_confirmation')) {
            const emailContent = bookingConfirmationEmail({
                clientName: client_name,
                therapistName: calendarService.therapist_name || 'your therapist',
                sessionTitle: calendarService.title,
                startTime: startTime.toISOString(),
                meetLink: meetLink,
                locationText: location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet',
                cancelToken: insertRes.rows[0].cancel_token,
                frontendUrl: process.env.FRONTEND_URL
            });
            await sendEmail({ to: client_email, ...emailContent, senderId: userId });
            console.log(`✅ Booking confirmation sent to client: ${client_email}`);
        } else {
            console.log(`⚠️ Booking confirmation disabled for client: ${client_email}`);
        }

        // Send confirmation email to therapist
        if (calendarService.therapist_email && await isEmailEnabled(userId, 'booking_confirmation_therapist')) {
            const therapistNotifContent = bookingConfirmationEmail({
                clientName: calendarService.therapist_name || 'Therapist',
                therapistName: client_name,
                sessionTitle: calendarService.title,
                startTime: startTime.toISOString(),
                meetLink: meetLink,
                locationText: location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet',
                cancelToken: null,
                frontendUrl: process.env.FRONTEND_URL
            });
            therapistNotifContent.subject = `New Booking — ${calendarService.title} with ${client_name}${partner_name ? ` & ${partner_name}` : ''}`;
            therapistNotifContent.html = therapistNotifContent.html
                .replace(
                    `Your session has been confirmed with <strong>${client_name}</strong>`,
                    `A new session has been booked by <strong>${client_name}</strong>${partner_name ? ` &amp; <strong>${partner_name}</strong>` : ''}`
                );
            await sendEmail({ to: calendarService.therapist_email, ...therapistNotifContent, senderId: userId });
            console.log(`✅ Booking confirmation sent to therapist: ${calendarService.therapist_email}`);
        } else {
            console.log(`⚠️ Booking confirmation NOT sent to therapist. Email: ${calendarService.therapist_email}, Preference enabled: ${calendarService.therapist_email ? await isEmailEnabled(userId, 'booking_confirmation_therapist') : false}`);
        }

        // If couples session — upsert partner as client and send them a confirmation too
        if (partner_name && partner_email) {
            try {
                await pool.query(
                    `INSERT INTO Clients (therapist_id, name, email, phone)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (therapist_id, email)
                     DO UPDATE SET
                        name = EXCLUDED.name,
                        phone = COALESCE(EXCLUDED.phone, Clients.phone),
                        updated_at = CURRENT_TIMESTAMP`,
                    [userId, partner_name, partner_email.trim().toLowerCase(), partner_phone || null]
                );
            } catch (partnerErr) {
                console.error('Failed to upsert partner client:', partnerErr.message);
            }
            const partnerEmailContent = bookingConfirmationEmail({
                clientName: partner_name,
                therapistName: calendarService.therapist_name || 'your therapist',
                sessionTitle: calendarService.title,
                startTime: startTime.toISOString(),
                meetLink: meetLink,
                locationText: location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet',
                cancelToken: insertRes.rows[0].cancel_token,
                frontendUrl: process.env.FRONTEND_URL
            });
            await sendEmail({ to: partner_email, ...partnerEmailContent, senderId: userId });
        }

        // Send confirmation to any additional email-type fields captured in the form
        // (e.g. "Second Email", "Guardian Email", etc.) — works for any calendar type
        try {
            const formQuestions = calendarService.form_data?.questions || [];
            const parsedResponses = form_responses
                ? (typeof form_responses === 'string' ? JSON.parse(form_responses) : form_responses)
                : {};

            // Find all questions with type 'email' that are NOT the primary email field
            const extraEmailQuestions = formQuestions.filter(
                (q) => q.type === 'email' && q.key !== 'email'
            );

            for (const q of extraEmailQuestions) {
                const extraEmail = parsedResponses[String(q.id)]?.trim();
                if (!extraEmail || extraEmail.toLowerCase() === client_email.toLowerCase()) continue;
                // Basic email format check
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extraEmail)) continue;

                const extraEmailContent = bookingConfirmationEmail({
                    clientName: client_name,
                    therapistName: calendarService.therapist_name || 'your therapist',
                    sessionTitle: calendarService.title,
                    startTime: startTime.toISOString(),
                    meetLink: meetLink,
                    locationText: location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet',
                    cancelToken: insertRes.rows[0].cancel_token,
                    frontendUrl: process.env.FRONTEND_URL
                });
                await sendEmail({ to: extraEmail, ...extraEmailContent, senderId: userId });
            }
        } catch (extraEmailErr) {
            console.error('Failed to send extra email confirmations:', extraEmailErr.message);
        }

        res.status(201).json(insertRes.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating public booking:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to create booking', details: error.message });
    } finally {
        client.release();
    }
});

// ─── Public booking management (unauthenticated, token-based) ─────────────────

// GET /api/bookings/manage/:token - Get booking details by cancel token
router.get('/manage/:token', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.id, a.title, a.start_time, a.end_time, a.status, a.meet_link,
                    a.client_name, a.client_email, a.location_type, a.cancel_token,
                    c.cancellation_policy, c.reschedule_policy, c.duration,
                    u.user_name as therapist_name
             FROM Appointments a
             JOIN Calendars c ON a.calendar_id = c.id
             JOIN Users u ON a.therapist_id = u.id
             WHERE a.cancel_token = $1`,
            [req.params.token]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

        const booking = result.rows[0];

        // Expire the link once the session start time has passed
        if (new Date(booking.start_time) <= new Date()) {
            return res.status(410).json({ error: 'This booking link has expired. The session has already started or passed.' });
        }

        res.json(booking);
    } catch (err) {
        console.error('Error fetching booking by token:', err);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
});

// POST /api/bookings/manage/:token/cancel - Client cancels their booking
router.post('/manage/:token/cancel', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const apptRes = await dbClient.query(
            `SELECT a.id, a.title, a.start_time, a.end_time, a.status,
                    a.client_name, a.client_email, a.therapist_id, a.calendar_id,
                    a.google_event_id, a.meet_link, a.cancel_token,
                    c.title as cal_title,
                    COALESCE(c.cancellation_policy, NULL) as cancellation_policy,
                    u.user_name as therapist_name, u.email as therapist_email
             FROM Appointments a
             LEFT JOIN Calendars c ON a.calendar_id = c.id
             JOIN Users u ON a.therapist_id = u.id
             WHERE a.cancel_token = $1`,
            [req.params.token]
        );

        if (apptRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
        const appt = apptRes.rows[0];

        if (appt.status === 'cancelled') return res.status(400).json({ error: 'Booking is already cancelled' });

        // Check cancellation window if policy exists
        const policy = appt.cancellation_policy;
        if (policy?.enabled && policy?.window) {
            const windowMs = parseInt(policy.window) * (policy.unit === 'days' ? 86400000 : policy.unit === 'hours' ? 3600000 : 60000);
            const timeUntilSession = new Date(appt.start_time).getTime() - Date.now();
            if (timeUntilSession < windowMs) {
                return res.status(400).json({
                    error: `Cancellations must be made at least ${policy.window} ${policy.unit} before the session.`
                });
            }
        }

        // Determine payment status based on refund policy
        const refundType = policy?.enabled ? (policy.refundType || 'full') : 'full';
        let refundAmount = 0;
        let refundPercentage = 100;
        let newPaymentStatus;

        if (refundType === 'none') {
            // No refund — keep as Paid, just mark cancelled
            refundAmount = 0;
            refundPercentage = 0;
            newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Paid' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
        } else if (refundType === 'partial') {
            refundPercentage = parseFloat(policy?.refundPercentage || 50);
            refundAmount = (appt.payment_amount * refundPercentage) / 100;
            newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Partial Refund' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
            
            // Log refund in RefundTracking table
            await dbClient.query(
                `INSERT INTO RefundTracking (appointment_id, original_amount, refund_amount, refund_percentage, refund_reason, refund_status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')`,
                [appt.id, appt.payment_amount, refundAmount, refundPercentage, 'Client cancellation']
            );
        } else {
            // Full refund (default)
            refundAmount = appt.payment_amount;
            refundPercentage = 100;
            newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Refunded' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
            
            // Log refund in RefundTracking table
            await dbClient.query(
                `INSERT INTO RefundTracking (appointment_id, original_amount, refund_amount, refund_percentage, refund_reason, refund_status)
                 VALUES ($1, $2, $3, $4, $5, 'pending')`,
                [appt.id, appt.payment_amount, refundAmount, refundPercentage, 'Client cancellation']
            );
        }

        // Update appointment with refund details
        await dbClient.query(
            `UPDATE Appointments SET
                status = 'cancelled',
                payment_status = ${newPaymentStatus},
                refund_amount = $1,
                refund_reason = 'Client cancellation',
                updated_at = NOW()
             WHERE id = $2`,
            [refundAmount, appt.id]
        );

        // Delete Google Calendar event to free the slot (non-fatal)
        if (appt.google_event_id) {
            try {
                const cancelAuth = await getGoogleAuthClient(appt.therapist_id);
                if (cancelAuth) {
                    const cal = google.calendar({ version: 'v3', auth: cancelAuth });
                    await cal.events.delete({ calendarId: 'primary', eventId: appt.google_event_id });
                    await dbClient.query('UPDATE Appointments SET google_event_id = NULL WHERE id = $1', [appt.id]);
                }
            } catch (gErr) {
                console.error('Google Calendar event deletion failed on client cancel:', gErr.message);
            }
        }

        // Notify therapist
        await createNotification({
            userId: appt.therapist_id,
            type: 'cancellation',
            title: 'Session Cancelled',
            description: `${appt.client_name} cancelled their session: ${appt.title}`,
            relatedId: appt.id
        });

        // Send cancellation emails if therapist has this preference enabled
        if (await isEmailEnabled(appt.therapist_id, 'cancellation')) {
            try {
                // Email client
                await sendEmail({
                    to: appt.client_email,
                    ...cancellationEmail({
                        clientName: appt.client_name,
                        therapistName: appt.therapist_name,
                        sessionTitle: appt.title,
                        startTime: appt.start_time,
                        cancelledBy: 'you'
                    }),
                    senderId: appt.therapist_id
                });
                console.log(`✅ Cancellation email sent to client: ${appt.client_email}`);
            } catch (err) {
                console.error(`❌ Client cancellation email failed for ${appt.client_email}:`, err.message);
            }

            try {
                // Email therapist
                await sendEmail({
                    to: appt.therapist_email,
                    ...cancellationEmail({
                        clientName: appt.client_name,
                        therapistName: appt.therapist_name,
                        sessionTitle: appt.title,
                        startTime: appt.start_time,
                        cancelledBy: appt.client_name
                    }),
                    senderId: appt.therapist_id
                });
                console.log(`✅ Cancellation email sent to therapist: ${appt.therapist_email}`);
            } catch (err) {
                console.error(`❌ Therapist cancellation email failed for ${appt.therapist_email}:`, err.message);
            }
        }

        res.json({ message: 'Booking cancelled successfully' });
    } catch (err) {
        console.error('Error cancelling booking:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to cancel booking', detail: err.message });
    } finally {
        dbClient.release();
    }
});

// POST /api/bookings/manage/:token/reschedule - Client reschedules their booking
router.post('/manage/:token/reschedule', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const { new_start_time } = req.body;
        if (!new_start_time) return res.status(400).json({ error: 'new_start_time is required' });

        const apptRes = await dbClient.query(
            `SELECT a.id, a.title, a.start_time, a.end_time, a.status,
                    a.client_name, a.client_email, a.therapist_id, a.calendar_id,
                    a.google_event_id, a.meet_link, a.cancel_token,
                    COALESCE(c.reschedule_policy, NULL) as reschedule_policy,
                    c.duration,
                    u.user_name as therapist_name, u.email as therapist_email,
                    ui.access_token, ui.refresh_token, ui.expiry_date
             FROM Appointments a
             LEFT JOIN Calendars c ON a.calendar_id = c.id
             JOIN Users u ON a.therapist_id = u.id
             LEFT JOIN UserIntegrations ui ON ui.user_id = a.therapist_id AND ui.provider = 'google'
             WHERE a.cancel_token = $1`,
            [req.params.token]
        );

        if (apptRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
        const appt = apptRes.rows[0];

        if (appt.status === 'cancelled') return res.status(400).json({ error: 'Cannot reschedule a cancelled booking' });

        // Check if rescheduling is allowed by policy
        const policy = appt.reschedule_policy;
        if (policy && policy.enabled === false) {
            return res.status(400).json({ error: 'Rescheduling is not allowed for this booking.' });
        }

        // Check reschedule window
        if (policy?.enabled && policy?.window) {
            const windowMs = parseInt(policy.window) * (policy.unit === 'days' ? 86400000 : policy.unit === 'hours' ? 3600000 : 60000);
            const timeUntilSession = new Date(appt.start_time).getTime() - Date.now();
            if (timeUntilSession < windowMs) {
                return res.status(400).json({
                    error: `Rescheduling must be done at least ${policy.window} ${policy.unit} before the session.`
                });
            }
        }

        const durationMatch = appt.duration?.match(/(\d+)/);
        const durationMinutes = durationMatch ? parseInt(durationMatch[0]) : 60;
        const newStart = new Date(new_start_time);
        const newEnd = new Date(newStart.getTime() + durationMinutes * 60000);

        // Calculate reschedule fee if applicable
        let rescheduleFeeToPay = 0;
        if (policy?.enabled && policy?.type === 'paid' && policy?.fee) {
            rescheduleFeeToPay = parseFloat(policy.fee);
            
            // Log fee in FeeTracking table
            await dbClient.query(
                `INSERT INTO FeeTracking (appointment_id, fee_type, fee_amount, fee_status, collected_at)
                 VALUES ($1, 'reschedule', $2, 'pending', NOW())`,
                [appt.id, rescheduleFeeToPay]
            );
        }

        // Update Google Calendar event if connected
        let newMeetLink = appt.meet_link;
        if (appt.google_event_id) {
            const rescheduleAuth = await getGoogleAuthClient(appt.therapist_id);
            if (rescheduleAuth) {
                try {
                    const calendar = google.calendar({ version: 'v3', auth: rescheduleAuth });
                    await calendar.events.patch({
                        calendarId: 'primary',
                        eventId: appt.google_event_id,
                        resource: { start: { dateTime: newStart.toISOString() }, end: { dateTime: newEnd.toISOString() } }
                    });
                } catch (gErr) {
                    console.error('Google Calendar update failed:', gErr.message);
                }
            }
        }

        // Update appointment with new times and fee
        await dbClient.query(
            `UPDATE Appointments SET 
                start_time = $1, 
                end_time = $2,
                reschedule_fee_charged = $3,
                updated_at = NOW()
             WHERE id = $4`,
            [newStart, newEnd, rescheduleFeeToPay, appt.id]
        );

        // Notify therapist
        await createNotification({
            userId: appt.therapist_id,
            type: 'reschedule',
            title: 'Session Rescheduled',
            description: `${appt.client_name} rescheduled their session: ${appt.title}`,
            relatedId: appt.id
        });

        // Send reschedule emails if therapist has this preference enabled
        if (await isEmailEnabled(appt.therapist_id, 'reschedule')) {
            try {
                // Email client
                const clientEmail = rescheduleConfirmationEmail({
                    clientName: appt.client_name,
                    therapistName: appt.therapist_name,
                    sessionTitle: appt.title,
                    newStartTime: newStart.toISOString(),
                    meetLink: newMeetLink
                });
                await sendEmail({ to: appt.client_email, ...clientEmail, senderId: appt.therapist_id });
                console.log(`✅ Reschedule email sent to client: ${appt.client_email}`);
            } catch (err) {
                console.error(`❌ Client reschedule email failed for ${appt.client_email}:`, err.message);
            }

            try {
                // Email therapist
                const therapistRescheduleEmail = rescheduleConfirmationEmail({
                    clientName: appt.therapist_name,
                    therapistName: appt.client_name,
                    sessionTitle: appt.title,
                    newStartTime: newStart.toISOString(),
                    meetLink: newMeetLink
                });
                therapistRescheduleEmail.subject = `Session Rescheduled — ${appt.title} with ${appt.client_name}`;
                await sendEmail({ to: appt.therapist_email, ...therapistRescheduleEmail, senderId: appt.therapist_id });
                console.log(`✅ Reschedule email sent to therapist: ${appt.therapist_email}`);
            } catch (err) {
                console.error(`❌ Therapist reschedule email failed for ${appt.therapist_email}:`, err.message);
            }
        }

        res.json({ message: 'Booking rescheduled successfully', new_start_time: newStart });
    } catch (err) {
        console.error('Error rescheduling booking:', err);
        res.status(500).json({ error: 'Failed to reschedule booking' });
    } finally {
        dbClient.release();
    }
});

router.use(ensureAuthenticated);

// GET /api/bookings/stats - Get dashboard statistics
router.get('/stats', ensureAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;

        // Build date filter clauses
        let dateFilter = '';        // for queries without table alias
        let dateFilterA = '';       // for queries using alias 'a'
        let params = [userId];

        if (startDate && endDate) {
            dateFilter = ' AND start_time >= $2 AND start_time <= $3';
            dateFilterA = ' AND a.start_time >= $2 AND a.start_time <= $3';
            params.push(startDate, endDate);
        }

        // Get total sessions
        const sessionsRes = await client.query(
            `SELECT COUNT(*) FROM Appointments WHERE therapist_id = $1${dateFilter}`,
            params
        );
        const totalSessions = parseInt(sessionsRes.rows[0].count);

        // Get cancelled sessions
        const cancelledRes = await client.query(
            `SELECT COUNT(*) FROM Appointments WHERE therapist_id = $1 AND status = 'cancelled'${dateFilter}`,
            params
        );
        const cancelledSessions = parseInt(cancelledRes.rows[0].count);

        // Get no-show sessions
        const noShowRes = await client.query(
            `SELECT COUNT(*) FROM Appointments WHERE therapist_id = $1 AND status = 'noshow'${dateFilter}`,
            params
        );
        const noShowSessions = parseInt(noShowRes.rows[0].count);

        // Calculate revenue
        const revenueRes = await client.query(
            `SELECT COALESCE(SUM(payment_amount), 0) as total FROM Appointments WHERE therapist_id = $1 AND payment_status IN ('Paid', 'Partial Refund') AND status != 'cancelled'${dateFilter}`,
            params
        );
        const revenue = parseFloat(revenueRes.rows[0].total || 0);

        // Calculate refunds
        const refundRes = await client.query(
            `SELECT COALESCE(SUM(payment_amount), 0) as total FROM Appointments WHERE therapist_id = $1 AND payment_status = 'Refunded'${dateFilter}`,
            params
        );
        const refund = parseFloat(refundRes.rows[0].total || 0);

        // Pending payments — exclude cancelled bookings
        const pendingPaymentRes = await client.query(
            `SELECT COUNT(*) FROM Appointments WHERE therapist_id = $1 AND payment_status = 'Pending' AND status != 'cancelled'${dateFilter}`,
            params
        );
        const pendingPayment = parseInt(pendingPaymentRes.rows[0].count);

        // Pending notes - scheduled appointments that have passed their end time (uses alias 'a')
        const pendingNotesRes = await client.query(
            `SELECT COUNT(*) FROM Appointments a 
             WHERE a.therapist_id = $1 AND a.status = 'scheduled'
             AND a.end_time < NOW()${dateFilterA}`,
            params
        );
        const pendingNotes = parseInt(pendingNotesRes.rows[0].count);

        // Count unique clients from Clients table (not date-filtered — total client base)
        const clientsRes = await client.query(
            `SELECT COUNT(*) FROM Clients WHERE therapist_id = $1`,
            [userId]
        );
        const totalClients = parseInt(clientsRes.rows[0].count);

        res.json({
            revenue: `₹${revenue}`,
            refund: `₹${refund}`,
            sessions: totalSessions,
            cancelled: cancelledSessions,
            noShow: noShowSessions,
            pendingNotes: pendingNotes,
            pendingPayment: pendingPayment,
            noOfClients: totalClients
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    } finally {
        client.release();
    }
});

// GET /api/bookings/clients - Get unique clients from appointments
router.get('/clients', ensureAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;

        // Fetch clients from Clients table with aggregated stats from Appointments
        // Exclude clients that have been transferred out (approved transfer from this therapist)
        const result = await client.query(
            `SELECT 
                c.id,
                c.name, 
                c.email, 
                c.phone,
                c.manually_added,
                COUNT(a.id) as sessions,
                COALESCE(SUM(CASE WHEN a.payment_status IN ('Paid', 'Partial Refund') AND a.status != 'cancelled' THEN a.payment_amount ELSE 0 END), 0) as total_revenue,
                (SELECT start_time FROM Appointments a2 WHERE LOWER(a2.client_email) = LOWER(c.email) AND a2.therapist_id = c.therapist_id ORDER BY a2.created_at DESC LIMIT 1) as last_session,
                (SELECT status FROM Appointments a2 WHERE LOWER(a2.client_email) = LOWER(c.email) AND a2.therapist_id = c.therapist_id ORDER BY a2.created_at DESC LIMIT 1) as last_session_status,
                c.age,
                c.occupation,
                c.gender,
                c.marital_status as "maritalStatus",
                c.emergency_name as "emergencyName",
                c.emergency_phone as "emergencyPhone",
                c.emergency_relation as "emergencyRelation"
            FROM Clients c
            LEFT JOIN Appointments a ON LOWER(c.email) = LOWER(a.client_email) AND c.therapist_id = a.therapist_id
            WHERE c.therapist_id = $1
              AND NOT EXISTS (
                SELECT 1 FROM ClientTransfers ct
                WHERE ct.client_id = c.id
                  AND ct.from_therapist_id = $1
                  AND ct.status = 'approved'
              )
            GROUP BY c.id`,
            [userId]
        );

        // Map to expected format
        const clients = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            email: row.email,
            sessions: row.sessions.toString(),
            revenue: `₹${parseFloat(row.total_revenue).toLocaleString('en-IN')}`,
            lastSession: row.last_session ? new Date(row.last_session).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            lastSessionRaw: row.last_session || null,
            lastSessionStatus: row.last_session_status || null,
            // Include other details for ClientView
            age: row.age || '-',
            occupation: row.occupation || '-',
            gender: row.gender || 'Male',
            maritalStatus: row.maritalStatus || 'Single',
            emergencyName: row.emergencyName || '-',
            emergencyPhone: row.emergencyPhone || '-',
            emergencyRelation: row.emergencyRelation || '-',
            manually_added: row.manually_added || false
        }));

        res.json(clients);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    } finally {
        client.release();
    }
});

// GET /api/bookings - Get all appointments
router.get('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { email, upcoming, enterprise } = req.query;

        // Check if user is enterprise owner
        const userRes = await client.query(
            'SELECT plan_name, org_role FROM users WHERE id = $1',
            [userId]
        );
        const user = userRes.rows[0];
        const isEnterpriseOwner = user && user.plan_name === 'team' && user.org_role !== 'member';

        // If enterprise mode and user is not owner, deny
        if (enterprise === 'true' && !isEnterpriseOwner) {
            return res.status(403).json({ error: 'Not authorized for enterprise analytics' });
        }

        let query = `
            SELECT
                a.id, a.therapist_id, a.client_id, a.calendar_id, a.title, a.start_time, a.end_time,
                a.status, a.google_event_id, a.meet_link, a.client_email, a.client_name, a.client_phone,
                a.payment_status, a.payment_amount, a.form_responses, a.location_type,
                a.cancel_token, a.cashfree_order_id, a.cashfree_payment_link, a.created_at,
                u.user_name as therapist_name,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', sn.id,
                            'content', sn.note_content,
                            'created_at', sn.created_at,
                            'attachments', COALESCE(sn.attachments, '[]'::jsonb)
                        )
                    ) FILTER (WHERE sn.id IS NOT NULL),
                    '[]'
                ) as notes
            FROM Appointments a
            LEFT JOIN SessionNotes sn ON a.id = sn.appointment_id AND sn.therapist_id = a.therapist_id
            LEFT JOIN users u ON a.therapist_id = u.id
        `;
        let params = [];

        if (enterprise === 'true') {
            // Enterprise owner - get all team members' bookings
            query += `
                WHERE a.therapist_id IN (
                    SELECT therapist_user_id FROM organization_therapists WHERE owner_id = $1 AND status = 'active' AND therapist_user_id IS NOT NULL
                    UNION
                    SELECT $1 as therapist_id
                )
            `;
            params.push(userId);
        } else {
            // Personal - get only this therapist's bookings
            query += ' WHERE a.therapist_id = $1';
            params.push(userId);
        }

        if (upcoming === 'true') {
            query += " AND a.start_time >= NOW() AND a.status = 'scheduled'";
        }

        if (email) {
            const emailParam = enterprise === 'true' ? params.length + 1 : 2;
            query += ` AND LOWER(a.client_email) = LOWER($${emailParam})`;
            params.push(email);
        }

        query += " GROUP BY a.id, u.user_name ORDER BY a.created_at DESC";

        const result = await client.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    } finally {
        client.release();
    }
});

// POST /api/bookings - Create appointment and sync to Google
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { calendar_id, start_time, client_email, client_name, payment_amount, location_type, payment_status } = req.body;

        if (!calendar_id || !start_time) {
            return res.status(400).json({ error: 'Calendar ID and Start Time are required' });
        }

        await client.query('BEGIN');

        // Check if client has been transferred out by this therapist
        if (client_email) {
            const transferCheck = await client.query(
                `SELECT ct.id FROM ClientTransfers ct
                 JOIN Clients c ON ct.client_id = c.id
                 WHERE c.email = $1
                   AND ct.from_therapist_id = $2
                   AND ct.status = 'approved'`,
                [client_email, userId]
            );
            if (transferCheck.rows.length > 0) {
                return res.status(403).json({ error: 'This client has been transferred and cannot be booked.' });
            }
        }

        // 1. Fetch Calendar Details
        const calendarRes = await client.query(
            'SELECT * FROM Calendars WHERE id = $1 AND user_id = $2',
            [calendar_id, userId]
        );

        if (calendarRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Calendar service not found' });
        }

        const calendarService = calendarRes.rows[0];

        // Parse duration (e.g., "50 m") to minutes
        const durationMatch = calendarService.duration.match(/(\d+)/);
        const durationMinutes = durationMatch ? parseInt(durationMatch[0]) : 60;

        const startTime = new Date(start_time);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // 2. Fetch Google Auth Client (handles token refresh automatically)
        const googleAuthClient2 = await getGoogleAuthClient(userId);

        let googleEventId = null;
        let meetLink = null;

        if (googleAuthClient2) {
            // 3. Create Google Calendar Event
            const calendar = google.calendar({ version: 'v3', auth: googleAuthClient2 });

            const event = {
                summary: `${calendarService.title} with ${client_name || 'Client'}`,
                description: calendarService.description,
                start: { dateTime: startTime.toISOString() },
                end: { dateTime: endTime.toISOString() },
                conferenceData: {
                    createRequest: {
                        requestId: `meet-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                },
                attendees: client_email ? [{ email: client_email }] : []
            };

            try {
                const googleRes = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                    conferenceDataVersion: 1
                });

                googleEventId = googleRes.data.id;
                meetLink = googleRes.data.hangoutLink;
            } catch (gError) {
                console.error('Google Calendar Sync Failed:', gError);
            }
        }

        // 4. Upsert Client Data
        await client.query(
            `INSERT INTO Clients (therapist_id, name, email, phone)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (therapist_id, email) 
             DO UPDATE SET 
                name = EXCLUDED.name,
                phone = COALESCE(EXCLUDED.phone, Clients.phone),
                updated_at = CURRENT_TIMESTAMP`,
            [userId, client_name, client_email, req.body.client_phone || null]
        );

        // Resolve phone: use submitted value, or fall back to what's stored in Clients table
        const resolvedPhoneRes = await client.query(
            `SELECT phone FROM Clients WHERE therapist_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
            [userId, client_email]
        );
        const resolvedPhone = req.body.client_phone || resolvedPhoneRes.rows[0]?.phone || null;

        // 5. Create Appointment in DB
        const appointmentDate = new Date(startTime);
        appointmentDate.setHours(0, 0, 0, 0);
        
        const insertRes = await client.query(
            `INSERT INTO Appointments 
       (therapist_id, calendar_id, title, start_time, end_time, appointment_date, google_event_id, meet_link, client_email, client_name, client_phone, payment_amount, payment_status, location_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
            [
                userId,
                calendar_id,
                calendarService.title,
                startTime,
                endTime,
                appointmentDate,
                googleEventId,
                meetLink,
                client_email,
                client_name,
                resolvedPhone,
                payment_amount || 0,
                payment_status || 'Pending',
                location_type || 'google_meet'
            ]
        );

        await client.query('COMMIT');

        // Notify therapist of manually created booking
        await createNotification({
            userId,
            type: 'new_booking',
            title: 'Booking Created',
            description: `A new session has been scheduled for ${client_name || 'a client'}`,
            relatedId: insertRes.rows[0].id
        });

        // Send confirmation email to client
        if (client_email && await isEmailEnabled(userId, 'booking_confirmation')) {
            const emailContent = bookingConfirmationEmail({
                clientName: client_name,
                therapistName: calendarService.therapist_name || 'your therapist',
                sessionTitle: calendarService.title,
                startTime: startTime.toISOString(),
                meetLink: meetLink,
                locationText: location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet',
                cancelToken: insertRes.rows[0].cancel_token,
                frontendUrl: process.env.FRONTEND_URL
            });
            await sendEmail({ to: client_email, ...emailContent, senderId: userId });
            console.log(`✅ Booking confirmation sent to client: ${client_email}`);
        }

        // Send confirmation email to therapist
        const therapistRes = await client.query('SELECT email FROM Users WHERE id = $1', [userId]);
        const therapistEmail = therapistRes.rows[0]?.email;
        if (therapistEmail && await isEmailEnabled(userId, 'booking_confirmation_therapist')) {
            const therapistNotifContent = bookingConfirmationEmail({
                clientName: 'Therapist',
                therapistName: client_name,
                sessionTitle: calendarService.title,
                startTime: startTime.toISOString(),
                meetLink: meetLink,
                locationText: location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet',
                cancelToken: null,
                frontendUrl: process.env.FRONTEND_URL
            });
            therapistNotifContent.subject = `New Booking — ${calendarService.title} with ${client_name}`;
            therapistNotifContent.html = therapistNotifContent.html
                .replace(
                    `Your session has been confirmed with <strong>${client_name}</strong>`,
                    `A new session has been booked by <strong>${client_name}</strong>`
                );
            await sendEmail({ to: therapistEmail, ...therapistNotifContent, senderId: userId });
            console.log(`✅ Booking confirmation sent to therapist: ${therapistEmail}`);
        }

        // Real-time update
        const io = getIO();
        if (io) {
            io.to(`user:${userId}`).emit('bookings_updated');
            io.to(`user:${userId}`).emit('clients_updated');
        }

        res.status(201).json(insertRes.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    } finally {
        client.release();
    }
});

// POST /api/bookings/:id/reminder - Send session reminder email to client
router.post('/:id/reminder', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const apptRes = await client.query(
            `SELECT a.*, u.user_name as therapist_name
             FROM Appointments a
             JOIN Users u ON a.therapist_id = u.id
             WHERE a.id = $1 AND a.therapist_id = $2`,
            [id, userId]
        );

        if (apptRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
        const appt = apptRes.rows[0];

        if (!appt.client_email) return res.status(400).json({ error: 'Client has no email address' });

        const startTime = new Date(appt.start_time);
        const formatted = startTime.toLocaleString('en-IN', {
            weekday: 'long', month: 'short', day: 'numeric',
            year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        if (!await isEmailEnabled(userId, 'session_reminder')) {
            return res.status(403).json({ error: 'Session reminder emails are disabled in your email preferences.' });
        }

        await sendEmail({
            to: appt.client_email,
            subject: `Reminder: Your session with ${appt.therapist_name} is coming up`,
            senderId: userId,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #1a1a1a;">
                    <h2 style="color: #082421;">Session Reminder</h2>
                    <p>Hi ${appt.client_name || 'there'},</p>
                    <p>This is a friendly reminder about your upcoming session:</p>
                    <div style="background: #f5f5f5; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
                        <p style="margin: 4px 0;"><strong>Session:</strong> ${appt.title}</p>
                        <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${formatted} IST</p>
                        <p style="margin: 4px 0;"><strong>Mode:</strong> ${appt.location_type === 'in_person' ? 'In-person' : 'Online (Google Meet)'}</p>
                        ${appt.meet_link ? `<p style="margin: 4px 0;"><strong>Join Link:</strong> <a href="${appt.meet_link}">${appt.meet_link}</a></p>` : ''}
                    </div>
                    <p>Please be on time. If you need to reschedule or cancel, please contact your therapist.</p>
                    <p style="color: #666; font-size: 13px; margin-top: 32px;">— ${appt.therapist_name} via MelloMinds</p>
                </div>
            `
        });

        res.json({ message: 'Reminder sent successfully' });
    } catch (err) {
        console.error('Error sending reminder:', err);
        res.status(500).json({ error: 'Failed to send reminder' });
    } finally {
        client.release();
    }
});

// PATCH /api/bookings/:id/reschedule - Therapist reschedules a booking
router.patch('/:id/reschedule', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { new_start_time } = req.body;

        if (!new_start_time) return res.status(400).json({ error: 'new_start_time is required' });

        // Fetch appointment + calendar duration + google tokens
        const apptRes = await client.query(
            `SELECT a.*, c.duration, c.title as cal_title,
                    u.user_name as therapist_name, u.email as therapist_email,
                    ui.access_token, ui.refresh_token, ui.expiry_date
             FROM Appointments a
             JOIN Calendars c ON a.calendar_id = c.id
             JOIN Users u ON a.therapist_id = u.id
             LEFT JOIN UserIntegrations ui ON ui.user_id = a.therapist_id AND ui.provider = 'google'
             WHERE a.id = $1 AND a.therapist_id = $2`,
            [id, userId]
        );

        if (apptRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
        const appt = apptRes.rows[0];

        if (appt.status === 'cancelled') return res.status(400).json({ error: 'Cannot reschedule a cancelled booking' });

        const durationMatch = appt.duration?.match(/(\d+)/);
        const durationMinutes = durationMatch ? parseInt(durationMatch[0]) : 60;
        const newStart = new Date(new_start_time);
        const newEnd = new Date(newStart.getTime() + durationMinutes * 60000);

        // Update Google Calendar event if connected
        if (appt.google_event_id) {
            const therapistAuth = await getGoogleAuthClient(userId);
            if (therapistAuth) {
                try {
                    const calendar = google.calendar({ version: 'v3', auth: therapistAuth });
                    await calendar.events.patch({
                        calendarId: 'primary',
                        eventId: appt.google_event_id,
                        resource: {
                            start: { dateTime: newStart.toISOString() },
                            end: { dateTime: newEnd.toISOString() }
                        }
                    });
                } catch (gErr) {
                    console.error('Google Calendar update failed:', gErr.message);
                }
            }
        }

        // Update DB
        const updated = await client.query(
            `UPDATE Appointments SET start_time = $1, end_time = $2 WHERE id = $3 AND therapist_id = $4 RETURNING *`,
            [newStart, newEnd, id, userId]
        );

        // Send reschedule email to client
        if (appt.client_email) {
            const emailContent = rescheduleConfirmationEmail({
                clientName: appt.client_name || 'Client',
                therapistName: appt.therapist_name,
                sessionTitle: appt.title,
                newStartTime: newStart.toISOString(),
                meetLink: appt.meet_link
            });
            try {
                await sendEmail({ to: appt.client_email, ...emailContent, senderId: userId });
                console.log(`✅ Reschedule notification sent to client: ${appt.client_email}`);
            } catch (err) {
                console.error(`❌ Reschedule notification failed for ${appt.client_email}:`, err.message);
            }
        }

        // Notify therapist of their own reschedule action
        createNotification({
            userId,
            type: 'reschedule',
            title: 'Session Rescheduled',
            description: `You rescheduled "${appt.title}" with ${appt.client_name || 'client'} to ${newStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}.`,
            relatedId: appt.id
        }).catch(() => {});

        // Real-time update
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('bookings_updated');

        res.json(updated.rows[0]);
    } catch (err) {
        console.error('Error rescheduling booking:', err);
        res.status(500).json({ error: 'Failed to reschedule booking' });
    } finally {
        client.release();
    }
});

// PATCH /api/bookings/:id/status - Update appointment status (cancelled, noshow, scheduled, completed)
router.patch('/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { status } = req.body;

        const allowed = ['scheduled', 'cancelled', 'completed', 'noshow'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
        }

        const result = await client.query(
            `UPDATE Appointments SET
               status = $1,
               payment_status = CASE
                 WHEN $4 AND payment_status = 'Paid'    THEN 'Refunded'
                 WHEN $4 AND payment_status = 'Pending' THEN 'Cancelled'
                 ELSE payment_status
               END
             WHERE id = $2 AND therapist_id = $3
             RETURNING *`,
            [status, id, userId, status === 'cancelled']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const appt = result.rows[0];

        // Fetch therapist name separately to avoid $1 type ambiguity in subquery
        const therapistRes = await client.query(
            `SELECT user_name as therapist_name FROM Users WHERE id = $1`,
            [userId]
        );
        appt.therapist_name = therapistRes.rows[0]?.therapist_name || '';

        // When cancelled: delete Google Calendar event to free the slot
        if (status === 'cancelled' && appt.google_event_id) {
            const cancelAuth = await getGoogleAuthClient(userId);
            if (cancelAuth) {
                try {
                    const calendar = google.calendar({ version: 'v3', auth: cancelAuth });
                    await calendar.events.delete({ calendarId: 'primary', eventId: appt.google_event_id });
                    await client.query('UPDATE Appointments SET google_event_id = NULL WHERE id = $1', [appt.id]);
                } catch (gErr) {
                    console.error('Google Calendar event deletion failed:', gErr.message);
                }
            }
        }

        // Send cancellation email to client when therapist cancels
        if (status === 'cancelled' && appt.client_email) {
            const emailContent = cancellationEmail({
                clientName: appt.client_name || 'Client',
                therapistName: appt.therapist_name || 'your therapist',
                sessionTitle: appt.title,
                startTime: appt.start_time,
                cancelledBy: 'your therapist'
            });
            try {
                await sendEmail({ to: appt.client_email, ...emailContent, senderId: userId });
                console.log(`✅ Cancellation email sent to client: ${appt.client_email}`);
            } catch (err) {
                console.error(`❌ Cancellation email failed for ${appt.client_email}:`, err.message);
            }
        }

        // Notify therapist of their own cancellation action
        if (status === 'cancelled') {
            createNotification({
                userId,
                type: 'cancellation',
                title: 'Session Cancelled',
                description: `You cancelled the session "${appt.title}" with ${appt.client_name || 'client'}.`,
                relatedId: appt.id
            }).catch(() => {});
        }

        // Real-time update
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('bookings_updated');

        res.json(appt);
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: 'Failed to update booking status' });
    } finally {
        client.release();
    }
});

// PATCH /api/bookings/:id/payment - Update payment status and/or amount
router.patch('/:id/payment', async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { payment_status, payment_amount } = req.body;

        const allowedStatuses = ['Pending', 'Paid', 'Refunded', 'Cancelled', 'Partial Refund'];
        if (payment_status && !allowedStatuses.includes(payment_status)) {
            return res.status(400).json({ error: `Invalid payment_status. Must be one of: ${allowedStatuses.join(', ')}` });
        }

        // Build dynamic update
        const fields = [];
        const params = [];
        let idx = 1;

        if (payment_status !== undefined) { fields.push(`payment_status = $${idx++}`); params.push(payment_status); }
        if (payment_amount !== undefined) { fields.push(`payment_amount = $${idx++}`); params.push(payment_amount); }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id, userId);

        const result = await client.query(
            `UPDATE Appointments SET ${fields.join(', ')}
             WHERE id = $${idx} AND therapist_id = $${idx + 1}
             RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Real-time update
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('bookings_updated');

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({ error: 'Failed to update payment' });
    } finally {
        client.release();
    }
});

// POST /api/bookings/send-link - Send booking link to client via email
router.post('/send-link', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { client_name, client_email, client_phone, calendar_id } = req.body;

        if (!client_name || !client_email || !calendar_id) {
            return res.status(400).json({ error: 'Client name, email and calendar are required' });
        }

        const calRes = await pool.query(
            `SELECT c.*, u.user_name as therapist_name
             FROM Calendars c JOIN Users u ON c.user_id = u.id
             WHERE c.id = $1 AND c.user_id = $2`,
            [calendar_id, userId]
        );
        if (calRes.rows.length === 0) {
            return res.status(404).json({ error: 'Calendar not found' });
        }
        const cal = calRes.rows[0];

        const userSlugRes = await pool.query('SELECT profile_slug FROM Users WHERE id = $1', [userId]);
        const identifier = userSlugRes.rows[0]?.profile_slug || userId;
        const bookingLink = `${process.env.FRONTEND_URL}/book/${identifier}/${cal.slug?.replace(/^\//, '')}`;

        const { bookingLinkEmail } = await import('../lib/email.js');
        if (!await isEmailEnabled(userId, 'booking_link')) {
            return res.status(403).json({ error: 'Booking link emails are disabled in your email preferences.' });
        }
        const emailContent = bookingLinkEmail({
            clientName: client_name,
            therapistName: cal.therapist_name,
            calendarTitle: cal.title,
            calendarDescription: cal.description || '',
            duration: cal.duration,
            bookingLink,
        });

        await sendEmail({ to: client_email, ...emailContent, senderId: userId });
        res.json({ message: 'Booking link sent successfully' });
    } catch (error) {
        console.error('Error sending booking link:', error);
        res.status(500).json({ error: 'Failed to send booking link' });
    }
});

// POST /api/bookings/send-link/bulk - Send booking link to multiple clients
router.post('/send-link/bulk', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { clients, calendar_id } = req.body;
        // clients: [{ name, email }]

        if (!Array.isArray(clients) || clients.length === 0 || !calendar_id) {
            return res.status(400).json({ error: 'clients array and calendar_id are required' });
        }
        if (clients.length > 100) {
            return res.status(400).json({ error: 'Cannot send to more than 100 clients at once' });
        }

        const calRes = await pool.query(
            `SELECT c.*, u.user_name as therapist_name
             FROM Calendars c JOIN Users u ON c.user_id = u.id
             WHERE c.id = $1 AND c.user_id = $2`,
            [calendar_id, userId]
        );
        if (calRes.rows.length === 0) {
            return res.status(404).json({ error: 'Calendar not found' });
        }
        const cal = calRes.rows[0];
        const bulkUserSlugRes = await pool.query('SELECT profile_slug FROM Users WHERE id = $1', [userId]);
        const bulkIdentifier = bulkUserSlugRes.rows[0]?.profile_slug || userId;
        const bookingLink = `${process.env.FRONTEND_URL}/book/${bulkIdentifier}/${cal.slug?.replace(/^\//, '')}`;
        const { bookingLinkEmail } = await import('../lib/email.js');

        const results = await Promise.allSettled(
            clients.map(({ name, email }) =>
                sendEmail({
                    to: email,
                    senderId: userId,
                    ...bookingLinkEmail({
                        clientName: name,
                        therapistName: cal.therapist_name,
                        calendarTitle: cal.title,
                        calendarDescription: cal.description || '',
                        duration: cal.duration,
                        bookingLink,
                    }),
                })
            )
        );

        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        res.json({ sent, failed, total: clients.length });
    } catch (error) {
        console.error('Error sending bulk booking links:', error);
        res.status(500).json({ error: 'Failed to send booking links' });
    }
});

// POST /api/bookings/:id/send-invoice - Email invoice to client
router.post('/:id/send-invoice', async (req, res) => {
    try {
        const userId = req.user.id;
        const bookingId = parseInt(req.params.id);

        const result = await pool.query(
            `SELECT a.*, u.user_name as therapist_name, u.email as therapist_email,
                    u.org_owner_id
             FROM Appointments a
             JOIN Users u ON a.therapist_id = u.id
             WHERE a.id = $1 AND a.therapist_id = $2`,
            [bookingId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const b = result.rows[0];

        if (!b.client_email) {
            return res.status(400).json({ error: 'Client has no email address on record' });
        }

        // Fetch org details — use owner's org if enterprise member, or own org if owner
        const orgOwnerId = b.org_owner_id || (req.user.plan_name === 'team' ? userId : null);
        let org = null;
        if (orgOwnerId) {
            const orgRes = await pool.query(
                'SELECT * FROM organization_details WHERE user_id = $1',
                [orgOwnerId]
            );
            if (orgRes.rows.length > 0) org = orgRes.rows[0];
        }

        const fromName = org?.company_name || b.therapist_name;
        const fromEmail = org?.company_email || b.therapist_email;
        const fromAddress = org
            ? [org.street, org.city, org.state, org.pincode, org.country].filter(Boolean).join(', ')
            : '';
        const gstLine = org?.gst ? `<div style="font-size:12px;color:#ccc;margin-top:2px;">GST: ${org.gst}</div>` : '';
        const therapistLine = org ? `<div style="font-size:13px;color:#ccc;margin-top:2px;">Therapist: ${b.therapist_name}</div>` : '';
        const addressLine = fromAddress ? `<div style="font-size:12px;color:#ccc;margin-top:2px;">${fromAddress}</div>` : '';

        const PAYMENT_STATUS_COLORS = {
            Paid:             { bg: '#e8f5e9', color: '#2e7d32' },
            Pending:          { bg: '#fff3e0', color: '#e65100' },
            Refunded:         { bg: '#fdecea', color: '#c62828' },
            'Partial Refund': { bg: '#fce4ec', color: '#880e4f' },
            Cancelled:        { bg: '#f5f5f5', color: '#6E6E6E' },
        };

        const display = (b.status === 'cancelled' && b.payment_status === 'Pending')
            ? 'Cancelled'
            : (b.payment_status || 'Pending');
        const sc = PAYMENT_STATUS_COLORS[display] || PAYMENT_STATUS_COLORS.Pending;

        const dateStr = new Date(b.start_time).toLocaleString('en-IN', {
            weekday: 'short', month: 'short', day: 'numeric',
            year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        const html = `
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"></head>
        <body style="font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;color:#1a1a1a;max-width:600px;margin:0 auto;background:#f9f9f9;">
          <div style="background:#082421;border-radius:12px 12px 0 0;padding:24px 32px;">
            <h1 style="color:#fff;margin:0;font-size:22px;">Payment Receipt</h1>
          </div>
          <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #082421;">
              <div>
                <div style="font-size:20px;font-weight:700;color:#082421;">${fromName}</div>
                ${therapistLine}
                ${addressLine}
                ${gstLine}
                <div style="font-size:12px;color:#999;margin-top:2px;">Payment Receipt</div>
              </div>
              <div style="text-align:right;font-size:13px;color:#555;">
                <div><strong>Receipt #${b.id}</strong></div>
                <div>${new Date(b.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>

            <div style="margin-bottom:20px;">
              <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Client Details</div>
              ${[['Name', b.client_name], ['Email', b.client_email], ['Phone', b.client_phone || '—']].map(([l, v]) =>
                `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:14px;">
                  <span style="color:#555;">${l}</span><span style="font-weight:600;">${v}</span>
                </div>`).join('')}
            </div>

            <div style="margin-bottom:20px;">
              <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Session Details</div>
              ${[
                ['Service', b.title || '—'],
                ['Date & Time', dateStr],
                ['Mode', b.location_type === 'in_person' ? 'In-person' : 'Online (Google Meet)'],
              ].map(([l, v]) =>
                `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:14px;">
                  <span style="color:#555;">${l}</span><span style="font-weight:600;">${v}</span>
                </div>`).join('')}
            </div>

            <div>
              <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Payment</div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:14px;">
                <span style="color:#555;">Status</span>
                <span style="background:${sc.bg};color:${sc.color};padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;">${display}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:16px;font-weight:700;border-top:2px solid #082421;margin-top:8px;">
                <span>Total Amount</span>
                <span>₹${parseFloat(b.payment_amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <div style="margin-top:24px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;">
              Thank you for choosing ${fromName}. For queries, contact ${fromEmail}
            </div>
          </div>
        </body></html>`;

        if (!await isEmailEnabled(userId, 'invoice')) {
            return res.status(403).json({ error: 'Invoice emails are disabled in your email preferences.' });
        }

        await sendEmail({
            to: b.client_email,
            subject: `Invoice for your session — ${b.title} (#${b.id})`,
            html,
            senderId: userId,
        });

        res.json({ message: 'Invoice sent successfully' });
    } catch (error) {
        console.error('Error sending invoice:', error);
        res.status(500).json({ error: 'Failed to send invoice' });
    }
});

// PATCH /api/bookings/:id/mark-payment-received - Mark offline payment as received
router.patch('/:id/mark-payment-received', ensureAuthenticated, async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const userId = req.user.id;
        const bookingId = parseInt(req.params.id);
        const { payment_method } = req.body;
        
        // Verify therapist owns this booking
        const apptRes = await dbClient.query(
            `SELECT id, payment_status, payment_amount FROM Appointments 
             WHERE id = $1 AND therapist_id = $2`,
            [bookingId, userId]
        );
        
        if (apptRes.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const appt = apptRes.rows[0];
        
        if (appt.payment_status !== 'Pending') {
            return res.status(400).json({ error: 'Payment already processed' });
        }
        
        // Update payment status
        const result = await dbClient.query(
            `UPDATE Appointments 
             SET payment_status = 'Paid', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [bookingId]
        );
        
        // Log payment verification
        await dbClient.query(
            `INSERT INTO PaymentVerification (appointment_id, verification_type, status, verified_at, verified_by)
             VALUES ($1, $2, 'verified', NOW(), $3)`,
            [bookingId, payment_method || 'manual', userId]
        );
        
        // Send confirmation email to client
        const apptData = result.rows[0];
        if (apptData.client_email && await isEmailEnabled(userId, 'payment_confirmation')) {
            const emailContent = bookingConfirmationEmail({
                clientName: apptData.client_name,
                therapistName: 'your therapist',
                sessionTitle: apptData.title,
                startTime: apptData.start_time,
                meetLink: apptData.meet_link,
                locationText: apptData.location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet',
                cancelToken: apptData.cancel_token,
                frontendUrl: process.env.FRONTEND_URL
            });
            await sendEmail({ to: apptData.client_email, ...emailContent, senderId: userId });
        }
        
        res.json({ 
            message: 'Payment marked as received',
            appointment: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error marking payment as received:', error);
        res.status(500).json({ error: 'Failed to mark payment as received' });
    } finally {
        dbClient.release();
    }
});

export default router;
