import express from 'express';
import pool from '../config/database.js';
import { isAuthenticated } from '../middleware/auth.js';
import { getIO } from '../lib/socket.js';

const router = express.Router();

const CONTROLLABLE_KEYS = [
    'booking_confirmation',
    'booking_confirmation_therapist',
    'cancellation',
    'reschedule',
    'session_reminder',
    'session_reminder_60min',
    'session_reminder_30min',
    'activity_notification',
    'booking_link',
    'invoice',
    'payment_confirmation',
    'transfer_request',
    'transfer_status',
    'use_own_email',
];

// GET /api/email-preferences
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT email_preferences FROM Users WHERE id = $1',
            [req.user.id]
        );
        res.json(result.rows[0]?.email_preferences || {});
    } catch (err) {
        console.error('Error fetching email preferences:', err.message);
        res.status(500).json({ error: 'Failed to fetch email preferences' });
    }
});

// PUT /api/email-preferences
router.put('/', isAuthenticated, async (req, res) => {
    try {
        const updates = req.body;

        // Only allow known controllable keys
        const sanitized = {};
        for (const key of CONTROLLABLE_KEYS) {
            if (typeof updates[key] === 'boolean') {
                sanitized[key] = updates[key];
            }
        }

        if (Object.keys(sanitized).length === 0) {
            return res.status(400).json({ error: 'No valid preference keys provided' });
        }

        // Merge with existing preferences
        await pool.query(
            `UPDATE Users
             SET email_preferences = email_preferences || $1::jsonb
             WHERE id = $2`,
            [JSON.stringify(sanitized), req.user.id]
        );

        const updated = await pool.query(
            'SELECT email_preferences FROM Users WHERE id = $1',
            [req.user.id]
        );

        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('email_preferences_updated');

        res.json(updated.rows[0].email_preferences);
    } catch (err) {
        console.error('Error updating email preferences:', err.message);
        res.status(500).json({ error: 'Failed to update email preferences' });
    }
});

export default router;
