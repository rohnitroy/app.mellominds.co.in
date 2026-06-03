import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { getIO } from '../lib/socket.js';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.CONNECT_CALENDAR_CALLBACK_URL || `http://localhost:${process.env.PORT || 3001}/api/connect-calendar/callback`
);

// Middleware to ensure authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

// GET /api/connect-calendar/start - Initiate OAuth
router.get('/start', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'profile',
        'email' // Add these to ensure Passport can verify the user identity for linking
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Critical for receiving refresh_token
        scope: scopes,
        prompt: 'consent', // Force consent to ensure we get refresh_token
        state: req.user.id.toString() // Store user ID in state (though Passport handles session)
    });

    // res.json({ url }); // Changed to redirect for better UX with direct link
    res.redirect(url);
});

// GET /api/connect-calendar/callback 
router.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
    }

    try {
        // 1. Exchange access code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // 2. Save tokens to database
        // We use an UPSERT (INSERT ... ON CONFLICT) to handle re-connections
        // Note: tokens.expiry_date is a timestamp (ms)

        // Check if we need to update or insert
        const existing = await pool.query(
            "SELECT * FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
            [req.user.id]
        );

        if (existing.rows.length > 0) {
            await pool.query(
                `UPDATE UserIntegrations 
                 SET access_token = $1, refresh_token = $2, expiry_date = $3, updated_at = NOW()
                 WHERE user_id = $4 AND provider = 'google'`,
                [tokens.access_token, tokens.refresh_token, tokens.expiry_date, req.user.id]
            );
        } else {
            await pool.query(
                `INSERT INTO UserIntegrations (user_id, provider, access_token, refresh_token, expiry_date)
                 VALUES ($1, 'google', $2, $3, $4)`,
                [req.user.id, tokens.access_token, tokens.refresh_token, tokens.expiry_date]
            );
        }

        // 3. Seed default availability (Mon–Fri, 9am–6pm IST) if none exists yet
        const existingAvail = await pool.query(
            'SELECT id FROM Availability WHERE user_id = $1 LIMIT 1',
            [req.user.id]
        );
        if (existingAvail.rows.length === 0) {
            const defaultSchedule = [
                { day: 1, start: '09:00', end: '18:00' }, // Monday
                { day: 2, start: '09:00', end: '18:00' }, // Tuesday
                { day: 3, start: '09:00', end: '18:00' }, // Wednesday
                { day: 4, start: '09:00', end: '18:00' }, // Thursday
                { day: 5, start: '09:00', end: '18:00' }, // Friday
            ];
            for (const s of defaultSchedule) {
                await pool.query(
                    `INSERT INTO Availability (user_id, day_of_week, start_time, end_time, is_enabled)
                     VALUES ($1, $2, $3, $4, true)`,
                    [req.user.id, s.day, s.start, s.end]
                );
            }
            console.log(`✅ Default availability seeded for user ${req.user.id}`);
        }

        // Emit real-time calendar update
        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('calendar_updated');

        // Redirect back to frontend
        res.redirect(`${process.env.FRONTEND_URL}/dashboard?calendar_connected=true`);

    } catch (error) {
        console.error('Error in Google Callback:', error);
        res.redirect(`${process.env.FRONTEND_URL}/dashboard?calendar_error=failed`);
    }
});

// GET /api/connect-calendar/status - Check if connected
router.get('/status', async (req, res) => {
    try {
        let targetUserId = req.user.id;

        // Team owner can check a member's connection status
        const { for_user_id } = req.query;
        if (for_user_id) {
            const ownerCheck = await pool.query(
                `SELECT id FROM organization_therapists
                 WHERE owner_id = $1 AND therapist_user_id = $2 AND status = 'active'`,
                [req.user.id, for_user_id]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Not authorized.' });
            }
            targetUserId = for_user_id;
        }

        const result = await pool.query(
            "SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
            [targetUserId]
        );
        res.json({ connected: result.rows.length > 0 });
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// DELETE /api/connect-calendar/disconnect - Remove Google Calendar connection
router.delete('/disconnect', async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM UserIntegrations WHERE user_id = $1 AND provider = 'google' RETURNING id",
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No Google Calendar connection found' });
        }

        // Emit real-time calendar update
        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('calendar_updated');

                res.json({ message: 'Google Calendar disconnected successfully' });
    } catch (error) {
        console.error('Error disconnecting calendar:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

export default router;
