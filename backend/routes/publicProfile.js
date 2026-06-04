import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// GET /api/public/therapists (debug endpoint)
// Lists all therapists with their usernames and profile slugs
router.get('/therapists', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, user_name, profile_slug, specialization, city, state, country
            FROM Users
            WHERE user_name IS NOT NULL
            ORDER BY user_name ASC
            LIMIT 50
        `);
        
        console.log(`📋 Found ${result.rows.length} therapists`);
        res.json({
            count: result.rows.length,
            therapists: result.rows
        });
    } catch (error) {
        console.error('Error fetching therapists list:', error);
        res.status(500).json({ error: 'Failed to fetch therapists' });
    }
});

// GET /api/public/profile/:identifier
// identifier = numeric user ID or custom profile slug
// Returns therapist public info + their active calendars
router.get('/profile/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        const isNumeric = /^\d+$/.test(identifier);

        console.log(`🔍 Searching for therapist profile: "${identifier}" (numeric: ${isNumeric})`);

        // First, check which columns exist in the Users table
        // Use explicit column list for safety (no dynamic SQL)
        const selectClause = 'id, user_name, profile_picture, specialization, language_spoken, city, state, country, about_me, profile_slug';

        // Try numeric ID first, then fall back to profile_slug
        const userResult = await pool.query(
            isNumeric
                ? `SELECT ${selectClause} FROM Users WHERE id = $1`
                : `SELECT ${selectClause} FROM Users WHERE (profile_slug = $1 OR LOWER(user_name) = LOWER($1))`,
            [identifier]
        );

        console.log(`📊 Query returned ${userResult.rows.length} result(s)`);

        if (userResult.rows.length === 0) {
            console.log(`❌ No user found for identifier: "${identifier}"`);
            return res.status(404).json({ error: 'Therapist not found' });
        }

        const user = userResult.rows[0];

        // Use explicit column list for safety (no dynamic SQL)
        const calSelectClause = 'id, title, slug, description, duration, type, locations, prices, payment_enabled';

        const calendarsResult = await pool.query(
            `SELECT ${calSelectClause}
             FROM Calendars
             WHERE user_id = $1 AND is_active = true
             ORDER BY created_at ASC`,
            [user.id]
        );

        // Helper function to convert language_spoken array to string
        const formatLanguages = (langs) => {
            if (!langs) return null;
            if (Array.isArray(langs)) {
                return langs.join(', ');
            }
            return langs;
        };

        res.json({
            id: user.id,
            name: user.user_name,
            profile_picture: user.profile_picture || null,
            specialization: user.specialization || null,
            language_spoken: formatLanguages(user.language_spoken),
            city: user.city || null,
            state: user.state || null,
            country: user.country || null,
            about_me: user.about_me || null,
            calendars: calendarsResult.rows.map(cal => ({
                ...cal,
                type: cal.type || 'one_on_one', // Default to one_on_one if not set
                locations: cal.locations || null,
                prices: cal.prices || null,
                payment_enabled: cal.payment_enabled || false
            })),
        });
    } catch (error) {
        console.error('Error fetching public profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

export default router;
