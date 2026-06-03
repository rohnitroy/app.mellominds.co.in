import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { isAuthenticated } from '../middleware/auth.js';
import { getIO } from '../lib/socket.js';

const router = express.Router();

function makeOAuthClient() {
    const callbackURL =
        process.env.GMAIL_CALLBACK_URL ||
        `http://localhost:${process.env.PORT || 3001}/api/gmail/callback`;

    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        callbackURL
    );
}

// GET /api/gmail/start
router.get('/start', isAuthenticated, (req, res) => {
    if (req.user.plan_name !== 'team') {
        return res.status(403).json({ error: 'Gmail sending is an Enterprise feature.' });
    }
    const oauth2Client = makeOAuthClient();
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.send', 'email', 'profile'],
        prompt: 'consent',
        state: req.user.id.toString(),
    });
    res.redirect(url);
});

// GET /api/gmail/callback
router.get('/callback', isAuthenticated, async (req, res) => {
    const { code, state } = req.query;
    if (!code) return res.redirect(`${process.env.FRONTEND_URL}/settings?gmail_error=missing_code`);
    if (state !== req.user.id.toString()) return res.redirect(`${process.env.FRONTEND_URL}/settings?gmail_error=state_mismatch`);

    try {
        const oauth2Client = makeOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        const gmailEmail = data.email;

        const existing = await pool.query(
            "SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = 'gmail'",
            [req.user.id]
        );
        if (existing.rows.length > 0) {
            await pool.query(
                `UPDATE UserIntegrations SET access_token=$1, refresh_token=$2, expiry_date=$3, gmail_email=$4, updated_at=NOW()
                 WHERE user_id=$5 AND provider='gmail'`,
                [tokens.access_token, tokens.refresh_token, tokens.expiry_date, gmailEmail, req.user.id]
            );
        } else {
            await pool.query(
                `INSERT INTO UserIntegrations (user_id, provider, access_token, refresh_token, expiry_date, gmail_email)
                 VALUES ($1, 'gmail', $2, $3, $4, $5)`,
                [req.user.id, tokens.access_token, tokens.refresh_token, tokens.expiry_date, gmailEmail]
            );
        }

        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('gmail_status_updated');

        res.redirect(`${process.env.FRONTEND_URL}/settings?gmail_connected=true`);
    } catch (err) {
        console.error('[gmail] OAuth callback error:', err.message);
        res.redirect(`${process.env.FRONTEND_URL}/settings?gmail_error=failed`);
    }
});

// GET /api/gmail/status
router.get('/status', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT gmail_email FROM UserIntegrations WHERE user_id=$1 AND provider='gmail'",
            [req.user.id]
        );
        const connected = result.rows.length > 0;
        res.json({ connected, gmail_email: connected ? result.rows[0].gmail_email : null });
    } catch (err) {
        console.error('[gmail] Status check error:', err.message);
        res.status(500).json({ error: 'Failed to check Gmail status' });
    }
});

// DELETE /api/gmail/disconnect
router.delete('/disconnect', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM UserIntegrations WHERE user_id=$1 AND provider='gmail' RETURNING access_token",
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No Gmail connection found' });

        await pool.query(
            `UPDATE Users SET email_preferences = email_preferences || '{"use_own_email": false}'::jsonb WHERE id=$1`,
            [req.user.id]
        );

        try {
            const oauth2Client = makeOAuthClient();
            await oauth2Client.revokeToken(result.rows[0].access_token);
        } catch (_) { /* non-fatal */ }

        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('gmail_status_updated');

        res.json({ message: 'Gmail disconnected successfully' });
    } catch (err) {
        console.error('[gmail] Disconnect error:', err.message);
        res.status(500).json({ error: 'Failed to disconnect Gmail' });
    }
});

export default router;
