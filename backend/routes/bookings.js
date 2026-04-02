import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { createNotification } from '../lib/notifications.js';
import { sendEmail, bookingConfirmationEmail, cancellationEmail, rescheduleConfirmationEmail } from '../lib/email.js';
import { getGoogleAuthClient } from '../lib/googleAuth.js';

const router = express.Router();

// Middleware to ensure authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// POST /api/bookings/public - Create appointment (Unauthenticated)
router.post('/public', async (req, res) => {
    const client = await pool.connect();
    try {
        const { calendar_id, start_time, client_email, client_name, client_phone, form_responses, location_type, cashfree_order_id, partner_name, partner_email, partner_phone } = req.body;

        if (!calendar_id || !start_time || !client_email || !client_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // 1. Fetch Calendar & Therapist Details
        const calendarRes = await client.query(
            `SELECT c.*, u.id as user_id 
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
                description: `Booking for ${client_name} (${client_email})\n\n${calendarService.description || ''}`,
                start: { dateTime: startTime.toISOString() },
                end: { dateTime: endTime.toISOString() },
                conferenceData: {
                    createRequest: {
                        requestId: `meet-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                },
                attendees: [{ email: client_email }]
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

        // 3. Create Appointment in DB
        // Use first configured price from calendar if payment is enabled
        const bookingAmount = calendarService.payment_enabled && calendarService.prices?.length
            ? (calendarService.prices[0]?.amount || 0)
            : 0;

        const insertRes = await client.query(
            `INSERT INTO Appointments 
       (therapist_id, calendar_id, title, start_time, end_time, google_event_id, meet_link, client_email, client_name, client_phone, payment_amount, payment_status, form_responses, location_type, cashfree_order_id, cancel_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, md5(random()::text || clock_timestamp()::text))
       RETURNING *`,
            [
                userId,
                calendar_id,
                calendarService.title,
                startTime,
                endTime,
                googleEventId,
                meetLink,
                client_email,
                client_name,
                client_phone || null,
                bookingAmount,
                cashfree_order_id ? 'Pending' : 'Pending',
                form_responses ? JSON.stringify(form_responses) : null,
                location_type || 'google_meet',
                cashfree_order_id || null
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

        // Send confirmation email to client
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
        await sendEmail({ to: client_email, ...emailContent });

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
            await sendEmail({ to: partner_email, ...partnerEmailContent });
        }

        res.status(201).json(insertRes.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating public booking:', error);
        res.status(500).json({ error: 'Failed to create booking' });
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
        let newPaymentStatus;
        if (refundType === 'none') {
            // No refund — keep as Paid, just mark cancelled
            newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Paid' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
        } else if (refundType === 'partial') {
            newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Partial Refund' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
        } else {
            // Full refund (default)
            newPaymentStatus = `CASE WHEN payment_status = 'Paid' THEN 'Refunded' WHEN payment_status = 'Pending' THEN 'Cancelled' ELSE payment_status END`;
        }

        await dbClient.query(
            `UPDATE Appointments SET
               status = 'cancelled',
               payment_status = ${newPaymentStatus}
             WHERE id = $1`,
            [appt.id]
        );

        // Notify therapist
        await createNotification({
            userId: appt.therapist_id,
            type: 'cancellation',
            title: 'Session Cancelled',
            description: `${appt.client_name} cancelled their session: ${appt.title}`,
            relatedId: appt.id
        });

        // Email client (non-fatal)
        sendEmail({
            to: appt.client_email,
            ...cancellationEmail({
                clientName: appt.client_name,
                therapistName: appt.therapist_name,
                sessionTitle: appt.title,
                startTime: appt.start_time,
                cancelledBy: 'you'
            })
        }).catch(err => console.error('Client cancellation email failed:', err.message));

        // Email therapist (non-fatal)
        sendEmail({
            to: appt.therapist_email,
            ...cancellationEmail({
                clientName: appt.client_name,
                therapistName: appt.therapist_name,
                sessionTitle: appt.title,
                startTime: appt.start_time,
                cancelledBy: appt.client_name
            })
        }).catch(err => console.error('Therapist cancellation email failed:', err.message));

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

        await dbClient.query(
            `UPDATE Appointments SET start_time = $1, end_time = $2 WHERE id = $3`,
            [newStart, newEnd, appt.id]
        );

        // Notify therapist
        await createNotification({
            userId: appt.therapist_id,
            type: 'reschedule',
            title: 'Session Rescheduled',
            description: `${appt.client_name} rescheduled their session: ${appt.title}`,
            relatedId: appt.id
        });

        // Email client
        const clientEmail = rescheduleConfirmationEmail({
            clientName: appt.client_name,
            therapistName: appt.therapist_name,
            sessionTitle: appt.title,
            newStartTime: newStart.toISOString(),
            meetLink: newMeetLink
        });
        await sendEmail({ to: appt.client_email, ...clientEmail });

        // Email therapist
        await sendEmail({ to: appt.therapist_email, ...clientEmail });

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
router.get('/stats', async (req, res) => {
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
            `SELECT COALESCE(SUM(payment_amount), 0) as total FROM Appointments WHERE therapist_id = $1 AND payment_status = 'Paid' AND status != 'cancelled'${dateFilter}`,
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

        // Pending notes - completed appointments without notes (uses alias 'a')
        const pendingNotesRes = await client.query(
            `SELECT COUNT(*) FROM Appointments a 
             WHERE a.therapist_id = $1 AND a.status = 'completed'
             AND NOT EXISTS (SELECT 1 FROM SessionNotes WHERE appointment_id = a.id)${dateFilterA}`,
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
router.get('/clients', async (req, res) => {
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
                COALESCE(SUM(CASE WHEN a.payment_status = 'Paid' AND a.status != 'cancelled' THEN a.payment_amount ELSE 0 END), 0) as total_revenue,
                MAX(a.start_time) as last_session,
                (SELECT status FROM Appointments a2 WHERE LOWER(a2.client_email) = LOWER(c.email) AND a2.therapist_id = c.therapist_id ORDER BY a2.start_time DESC LIMIT 1) as last_session_status,
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
        const { email, upcoming } = req.query;

        let query = `
            SELECT 
                a.*, 
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', sn.id, 
                            'content', sn.note_content, 
                            'created_at', sn.created_at
                        )
                    ) FILTER (WHERE sn.id IS NOT NULL), 
                    '[]'
                ) as notes
            FROM Appointments a
            LEFT JOIN SessionNotes sn ON a.id = sn.appointment_id AND sn.therapist_id = $1
            WHERE a.therapist_id = $1
        `;
        let params = [userId];

        if (upcoming === 'true') {
            query += " AND a.start_time >= NOW() AND a.status = 'scheduled'";
        }

        if (email) {
            query += " AND LOWER(a.client_email) = LOWER($2)";
            params.push(email);
        }

        query += " GROUP BY a.id ORDER BY a.start_time DESC";

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

        // 5. Create Appointment in DB
        const insertRes = await client.query(
            `INSERT INTO Appointments 
       (therapist_id, calendar_id, title, start_time, end_time, google_event_id, meet_link, client_email, client_name, client_phone, payment_amount, payment_status, location_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
            [
                userId,
                calendar_id,
                calendarService.title,
                startTime,
                endTime,
                googleEventId,
                meetLink,
                client_email,
                client_name,
                req.body.client_phone || null,
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

        await sendEmail({
            to: appt.client_email,
            subject: `Reminder: Your session with ${appt.therapist_name} is coming up`,
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
            sendEmail({ to: appt.client_email, ...emailContent }).catch(() => {});
        }

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
            sendEmail({ to: appt.client_email, ...emailContent }).catch(() => {});
        }

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

        const allowedStatuses = ['Pending', 'Paid', 'Refunded', 'Cancelled'];
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

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({ error: 'Failed to update payment' });
    } finally {
        client.release();
    }
});

// POST /api/bookings/send-link - Send booking link to client via email
router.post('/send-link', async (req, res) => {
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

        const bookingLink = `${process.env.FRONTEND_URL}/book/${userId}/${cal.slug?.replace(/^\//, '')}`;

        const { bookingLinkEmail } = await import('../lib/email.js');
        const emailContent = bookingLinkEmail({
            clientName: client_name,
            therapistName: cal.therapist_name,
            calendarTitle: cal.title,
            calendarDescription: cal.description || '',
            duration: cal.duration,
            bookingLink,
        });

        await sendEmail({ to: client_email, ...emailContent });
        res.json({ message: 'Booking link sent successfully' });
    } catch (error) {
        console.error('Error sending booking link:', error);
        res.status(500).json({ error: 'Failed to send booking link' });
    }
});

export default router;
