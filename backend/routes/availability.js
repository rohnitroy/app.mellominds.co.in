import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
);

// Middleware
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

// GET /api/availability - Get user's weekly availability settings
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM Availability WHERE user_id = $1 ORDER BY day_of_week, start_time',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// POST /api/availability - Update weekly availability
router.post('/', ensureAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const { schedule } = req.body; // Array of { day_of_week, start_time, end_time, is_enabled }

        console.log(`Updating availability for User ID: ${req.user.id}`);
        // console.log('Schedule payload:', JSON.stringify(schedule, null, 2)); // Uncomment if needed, but might be verbose

        await client.query('BEGIN');

        // Clear existing availability for user (simple replacement strategy)
        await client.query('DELETE FROM Availability WHERE user_id = $1', [req.user.id]);

        // Insert new schedule
        for (const slot of schedule) {
            // Validate data before insert
            if (!slot.start_time || !slot.end_time) {
                console.warn(`Skipping invalid slot for day ${slot.day_of_week}: missing times`);
                continue;
            }
            await client.query(
                `INSERT INTO Availability (user_id, day_of_week, start_time, end_time, is_enabled)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.user.id, slot.day_of_week, slot.start_time, slot.end_time, slot.is_enabled]
            );
        }

        await client.query('COMMIT');
        console.log('Availability updated successfully');
        res.json({ message: 'Availability updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating availability - Full Error:', error);
        res.status(500).json({ error: 'Failed to update availability', details: error.message });
    } finally {
        client.release();
    }
});

// GET /api/availability/slots?date=YYYY-MM-DD&calendar_id=...
// Public endpoint for checking slots
router.get('/slots', async (req, res) => {
    const client = await pool.connect();
    try {
        const { date, calendar_id, calendarId, timeZone = 'Asia/Kolkata' } = req.query;
        const calId = calendar_id || calendarId; // accept both param names

        if (!date || !calId) {
            return res.status(400).json({ error: 'Date and calendar_id are required' });
        }

        // 1. Get Calendar & Therapist Info
        const calRes = await client.query('SELECT user_id, duration FROM Calendars WHERE id = $1', [calId]);
        if (calRes.rows.length === 0) return res.status(404).json({ error: 'Calendar not found' });

        const { user_id: therapistId, duration } = calRes.rows[0];
        const durationMinutes = parseInt((duration || '60').match(/\d+/)[0]) || 60;

        // 2. Determine Day of Week (0=Sun, 6=Sat)
        const selectedDate = new Date(date + 'T00:00:00');
        const dayOfWeek = selectedDate.getDay();

        // 3. Fetch Platform Availability for that day
        const availRes = await client.query(
            `SELECT start_time, end_time 
             FROM Availability 
             WHERE user_id = $1 AND day_of_week = $2 AND is_enabled = true`,
            [therapistId, dayOfWeek]
        );

        if (availRes.rows.length === 0) {
            return res.json({ slots: [] });
        }

        // 4. Fetch Google Calendar busy times (optional)
        let busySlots = [];
        const tokenRes = await client.query(
            "SELECT access_token, refresh_token, expiry_date FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
            [therapistId]
        );

        if (tokenRes.rows.length > 0) {
            try {
                oauth2Client.setCredentials(tokenRes.rows[0]);
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                const timeMin = new Date(date + 'T00:00:00').toISOString();
                const timeMax = new Date(date + 'T23:59:59').toISOString();
                const fbRes = await calendar.freebusy.query({
                    requestBody: { timeMin, timeMax, timeZone, items: [{ id: 'primary' }] }
                });
                busySlots = fbRes.data.calendars.primary.busy || [];
            } catch (gErr) {
                console.error('Google FreeBusy Error:', gErr.message);
            }
        }

        // 5. Fetch internal appointments busy times
        const apptRes = await client.query(
            `SELECT start_time, end_time FROM Appointments 
             WHERE therapist_id = $1 
             AND start_time >= $2::date 
             AND start_time < ($2::date + interval '1 day')
             AND status != 'cancelled'`,
            [therapistId, date]
        );

        const allBusy = [
            ...busySlots.map(s => ({ start: new Date(s.start).getTime(), end: new Date(s.end).getTime() })),
            ...apptRes.rows.map(r => ({ start: new Date(r.start_time).getTime(), end: new Date(r.end_time).getTime() }))
        ];

        // 6. Generate available slots
        const formatSlot = (d) => {
            let h = d.getHours();
            const m = d.getMinutes();
            const period = h >= 12 ? 'PM' : 'AM';
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
            return `${h}:${m.toString().padStart(2, '0')}${period}`;
        };

        const availableSlots = [];

        for (const window of availRes.rows) {
            const [h1, m1] = window.start_time.split(':').map(Number);
            const [h2, m2] = window.end_time.split(':').map(Number);

            let slotStart = new Date(date + 'T00:00:00');
            slotStart.setHours(h1, m1, 0, 0);

            const windowEnd = new Date(date + 'T00:00:00');
            windowEnd.setHours(h2, m2, 0, 0);

            while (slotStart.getTime() + durationMinutes * 60000 <= windowEnd.getTime()) {
                const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
                const isBusy = allBusy.some(b => slotStart.getTime() < b.end && slotEnd.getTime() > b.start);
                if (!isBusy) availableSlots.push(formatSlot(slotStart));
                slotStart = new Date(slotStart.getTime() + 30 * 60000);
            }
        }

        res.json({ slots: availableSlots });

    } catch (error) {
        console.error('Error calculating slots:', error);
        res.status(500).json({ error: 'Failed to calculate availability' });
    } finally {
        client.release();
    }
});

export default router;
