import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { getGoogleAuthClient } from '../lib/googleAuth.js';

const router = express.Router();

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

        console.log(`[DEBUG] Slots request: date=${date}, calendarId=${calId}, timeZone=${timeZone}`);

        if (!date || !calId) {
            return res.status(400).json({ error: 'Date and calendar_id are required' });
        }

        // 1. Get Calendar & Therapist Info (including schedule_settings for date range)
        const calRes = await client.query('SELECT user_id, duration, schedule_settings FROM Calendars WHERE id = $1', [calId]);
        console.log(`[DEBUG] Calendar query result: ${calRes.rows.length} rows`);
        if (calRes.rows.length === 0) return res.status(404).json({ error: 'Calendar not found' });

        const { user_id: therapistId, duration, schedule_settings } = calRes.rows[0];
        console.log(`[DEBUG] Therapist ID: ${therapistId}, Duration: ${duration}`);
        const durationMinutes = parseInt((duration || '60').match(/\d+/)[0]) || 60;

        // Enforce date range from schedule_settings
        const settings = schedule_settings || {};
        const dateRangeType = settings.dateRangeType || 'calendar_days';
        const dateRangeValue = parseInt(settings.dateRangeValue || '60');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const requestedDate = new Date(date + 'T00:00:00');
        requestedDate.setHours(0, 0, 0, 0);

        if (dateRangeType === 'calendar_days') {
            const maxDate = new Date(today);
            maxDate.setDate(today.getDate() + dateRangeValue);
            if (requestedDate > maxDate) return res.json([]);

        } else if (dateRangeType === 'business_days') {
            // Walk forward counting only Mon–Fri
            let count = 0;
            const cursor = new Date(today);
            while (count < dateRangeValue) {
                cursor.setDate(cursor.getDate() + 1);
                const dow = cursor.getDay();
                if (dow !== 0 && dow !== 6) count++;
            }
            if (requestedDate > cursor) return res.json([]);

        } else if (dateRangeType === 'range') {
            // Specific start–end date window
            const rangeStart = settings.dateRangeStart ? new Date(settings.dateRangeStart + 'T00:00:00') : today;
            const rangeEnd = settings.dateRangeEnd ? new Date(settings.dateRangeEnd + 'T00:00:00') : null;
            rangeStart.setHours(0, 0, 0, 0);
            if (requestedDate < rangeStart) return res.json([]);
            if (rangeEnd) {
                rangeEnd.setHours(0, 0, 0, 0);
                if (requestedDate > rangeEnd) return res.json([]);
            }
        }
        // 'indefinitely' — no upper bound, allow any future date
        else if (dateRangeType === 'indefinitely') {
            // no restriction
        }

        // 2. Determine Day of Week in the therapist's timezone (IST)
        const [dy, dm, dd] = date.split('-').map(Number);
        const istDate = new Date(Date.UTC(dy, dm - 1, dd, 0, 0, 0));
        const dayOfWeekStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' })
            .formatToParts(istDate)
            .find(p => p.type === 'weekday')?.value;
        const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const dayOfWeekNum = dayMap[dayOfWeekStr] ?? istDate.getUTCDay();

        // 3. Fetch Platform Availability for that day
        const availRes = await client.query(
            `SELECT start_time, end_time 
             FROM Availability 
             WHERE user_id = $1 AND day_of_week = $2 AND is_enabled = true`,
            [therapistId, dayOfWeekNum]
        );

        console.log(`[DEBUG] Availability query: therapistId=${therapistId}, dayOfWeek=${dayOfWeekNum}, results=${availRes.rows.length}`);

        if (availRes.rows.length === 0) {
            console.log(`[DEBUG] No availability found for therapist ${therapistId} on day ${dayOfWeekNum}`);
            return res.json([]);
        }

        // 4. Fetch Google Calendar busy times (optional — gracefully skipped if not connected or token invalid)
        let busySlots = [];
        const authClient = await getGoogleAuthClient(therapistId);
        if (authClient) {
            try {
                const calendar = google.calendar({ version: 'v3', auth: authClient });
                const timeMin = new Date(date + 'T00:00:00').toISOString();
                const timeMax = new Date(date + 'T23:59:59').toISOString();
                const fbRes = await calendar.freebusy.query({
                    requestBody: { timeMin, timeMax, timeZone, items: [{ id: 'primary' }] }
                });
                busySlots = fbRes.data.calendars.primary.busy || [];
            } catch (gErr) {
                console.error('Google FreeBusy Error:', gErr.message);
                // Non-fatal — continue without Google busy times
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
        // Slot times are stored as IST in the Availability table (therapist's local time).
        // We generate slots in IST, then format them in the client's requested timezone.
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

        const toISTMidnight = (dateStr) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - IST_OFFSET_MS);
        };

        // Format a UTC ms timestamp as a slot label in the requested timezone
        const formatSlot = (utcMs) => {
            const d = new Date(utcMs);
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }).formatToParts(d);
            const hour = parts.find(p => p.type === 'hour')?.value || '12';
            const minute = parts.find(p => p.type === 'minute')?.value || '00';
            const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value?.toUpperCase() || 'AM';
            return `${hour}:${minute}${dayPeriod}`;
        };

        // Extract buffer settings
        const bufferType = settings.bufferType || 'after_event';
        const bufferMinutes = parseInt(settings.bufferTime || '0') || 0;
        const bufferMs = bufferMinutes * 60000;

        // Compute minimum notice cutoff — slots before this timestamp are hidden
        const rawMinNotice = parseInt(settings.minNotice || '0') || 0;
        const minNoticeUnit = settings.minNoticeUnit || 'Minutes';
        const minNoticeMs = minNoticeUnit === 'Days'
            ? rawMinNotice * 24 * 60 * 60000
            : minNoticeUnit === 'Hours'
                ? rawMinNotice * 60 * 60000
                : rawMinNotice * 60000;
        // Always enforce at least 0 ms (no hardcoded 30-min floor — minNotice replaces it)
        const noticeCutoff = Date.now() + Math.max(minNoticeMs, 0);

        const availableSlots = [];
        const istMidnight = toISTMidnight(date);

        for (const window of availRes.rows) {
            const [h1, m1] = window.start_time.split(':').map(Number);
            const [h2, m2] = window.end_time.split(':').map(Number);

            // Build slot start/end as UTC timestamps (availability times are in IST)
            let slotStartMs = istMidnight.getTime() + (h1 * 60 + m1) * 60000;
            const windowEndMs = istMidnight.getTime() + (h2 * 60 + m2) * 60000;

            while (slotStartMs + durationMinutes * 60000 <= windowEndMs) {
                const slotEndMs = slotStartMs + durationMinutes * 60000;

                // Expand the busy-check window based on buffer type
                const checkStart = bufferType === 'before_event'
                    ? slotStartMs - bufferMs
                    : slotStartMs;
                const checkEnd = bufferType === 'after_event'
                    ? slotEndMs + bufferMs
                    : slotEndMs;

                const isBusy = allBusy.some(b => checkStart < b.end && checkEnd > b.start);
                const isPast = slotStartMs < noticeCutoff;

                if (!isBusy && !isPast) availableSlots.push(formatSlot(slotStartMs));

                // Advance: duration + after_event buffer (before_event buffer doesn't shift the step)
                const stepMs = durationMinutes * 60000 + (bufferType === 'after_event' ? bufferMs : 0);
                slotStartMs += Math.max(stepMs, 30 * 60000); // minimum 30-min step to avoid infinite loop
            }
        }

        res.json(availableSlots);
        console.log(`[DEBUG] Returning ${availableSlots.length} available slots`);

    } catch (error) {
        console.error('Error calculating slots:', error);
        console.error('[DEBUG] Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ error: 'Failed to calculate availability' });
    } finally {
        client.release();
    }
});

export default router;
