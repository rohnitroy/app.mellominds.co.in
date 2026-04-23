import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/public/profile/:identifier
// identifier = numeric user ID or custom profile slug
// Returns therapist public info + their active calendars
router.get('/profile/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const isNumeric = /^\d+$/.test(identifier);

        // Try numeric ID first, then fall back to profile_slug
        const userResult = await pool.query(
            isNumeric
                ? `SELECT id, user_name, profile_picture, specialization, language_spoken, city, state, country
                   FROM Users WHERE id = $1`
                : `SELECT id, user_name, profile_picture, specialization, language_spoken, city, state, country
                   FROM Users WHERE profile_slug = $1 OR LOWER(user_name) = LOWER($1)`,
            [identifier]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Therapist not found' });
        }

        const user = userResult.rows[0];

        const calendarsResult = await pool.query(
            `SELECT id, title, slug, description, duration, type, locations, prices, payment_enabled
             FROM Calendars
             WHERE user_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [user.id]
        );

        res.json({
            id: user.id,
            name: user.user_name,
            profile_picture: user.profile_picture || null,
            specialization: user.specialization || null,
            language_spoken: user.language_spoken || null,
            city: user.city || null,
            state: user.state || null,
            country: user.country || null,
            calendars: calendarsResult.rows,
        });
    } catch (error) {
        console.error('Error fetching public profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

export default router;
