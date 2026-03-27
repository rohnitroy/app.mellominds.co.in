import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { createNotification } from '../lib/notifications.js';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
);

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
        const { calendar_id, start_time, client_email, client_name, client_phone, form_responses } = req.body;

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

        // Parse duration
        const durationMatch = calendarService.duration.match(/(\d+)/);
        const durationMinutes = durationMatch ? parseInt(durationMatch[0]) : 60;

        const startTime = new Date(start_time);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // 2. Fetch Google Tokens (for Therapist)
        const tokenRes = await client.query(
            "SELECT access_token, refresh_token, expiry_date FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
            [userId]
        );

        let googleEventId = null;
        let meetLink = null;

        if (tokenRes.rows.length > 0) {
            const tokens = tokenRes.rows[0];
            oauth2Client.setCredentials({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expiry_date: tokens.expiry_date
            });

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

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
        const insertRes = await client.query(
            `INSERT INTO Appointments 
       (therapist_id, calendar_id, title, start_time, end_time, google_event_id, meet_link, client_email, client_name, client_phone, payment_amount, payment_status, form_responses)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Pending', $12)
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
                0, // Assuming free or payment handled elsewhere for now
                form_responses ? JSON.stringify(form_responses) : null
            ]
        );

        await client.query('COMMIT');

        // Notify therapist of new booking (public)
        await createNotification({
            userId,
            type: 'new_booking',
            title: 'New Booking',
            description: `You have received a new booking from ${client_name}`,
            relatedId: insertRes.rows[0].id
        });

        res.status(201).json(insertRes.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating public booking:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    } finally {
        client.release();
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
            `SELECT COALESCE(SUM(payment_amount), 0) as total FROM Appointments WHERE therapist_id = $1 AND payment_status = 'Paid'${dateFilter}`,
            params
        );
        const revenue = parseFloat(revenueRes.rows[0].total || 0);

        // Calculate refunds
        const refundRes = await client.query(
            `SELECT COALESCE(SUM(payment_amount), 0) as total FROM Appointments WHERE therapist_id = $1 AND payment_status = 'Refunded'${dateFilter}`,
            params
        );
        const refund = parseFloat(refundRes.rows[0].total || 0);

        // Pending payments
        const pendingPaymentRes = await client.query(
            `SELECT COUNT(*) FROM Appointments WHERE therapist_id = $1 AND payment_status = 'Pending'${dateFilter}`,
            params
        );
        const pendingPayment = parseInt(pendingPaymentRes.rows[0].count);

        // Pending notes - appointments without notes (uses alias 'a')
        const pendingNotesRes = await client.query(
            `SELECT COUNT(*) FROM Appointments a 
             WHERE a.therapist_id = $1 AND a.status NOT IN ('cancelled', 'noshow')
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
        const result = await client.query(
            `SELECT 
                c.id,
                c.name, 
                c.email, 
                c.phone,
                COUNT(a.id) as sessions,
                COALESCE(SUM(a.payment_amount), 0) as total_revenue,
                MAX(a.start_time) as last_session,
                c.age,
                c.occupation,
                c.gender,
                c.marital_status as "maritalStatus",
                c.emergency_name as "emergencyName",
                c.emergency_phone as "emergencyPhone",
                c.emergency_relation as "emergencyRelation"
            FROM Clients c
            LEFT JOIN Appointments a ON c.email = a.client_email AND c.therapist_id = a.therapist_id
            WHERE c.therapist_id = $1 
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
            revenue: `₹${row.total_revenue}`,
            lastSession: row.last_session ? new Date(row.last_session).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            // Include other details for ClientView
            age: row.age || '-',
            occupation: row.occupation || '-',
            gender: row.gender || 'Male',
            maritalStatus: row.maritalStatus || 'Single',
            emergencyName: row.emergencyName || '-',
            emergencyPhone: row.emergencyPhone || '-',
            emergencyRelation: row.emergencyRelation || '-'
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
            query += ' AND a.start_time >= NOW() AND a.status != \'cancelled\'';
        }

        if (email) {
            query += " AND a.client_email = $2"; // Note the table alias 'a'
            params.push(email);
        }

        query += " GROUP BY a.id ORDER BY a.start_time ASC";

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
        const { calendar_id, start_time, client_email, client_name, payment_amount } = req.body;

        if (!calendar_id || !start_time) {
            return res.status(400).json({ error: 'Calendar ID and Start Time are required' });
        }

        await client.query('BEGIN');

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

        // 2. Fetch Google Tokens
        const tokenRes = await client.query(
            "SELECT access_token, refresh_token, expiry_date FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
            [userId]
        );

        let googleEventId = null;
        let meetLink = null;

        if (tokenRes.rows.length > 0) {
            const tokens = tokenRes.rows[0];

            // Set credentials
            oauth2Client.setCredentials({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expiry_date: tokens.expiry_date
            });

            // 3. Create Google Calendar Event
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

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
                // We continue to save local appointment even if sync fails, but warn user?
                // For now, proceed.
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
       (therapist_id, calendar_id, title, start_time, end_time, google_event_id, meet_link, client_email, client_name, client_phone, payment_amount, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Pending')
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
                payment_amount || 0
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
            `UPDATE Appointments SET status = $1
             WHERE id = $2 AND therapist_id = $3
             RETURNING *`,
            [status, id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json(result.rows[0]);
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

        const allowedStatuses = ['Pending', 'Paid', 'Refunded'];
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

export default router;
