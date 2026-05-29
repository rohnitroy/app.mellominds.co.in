import express from 'express';
import pool from '../config/database.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$/;
const RESERVED = ['admin', 'api', 'login', 'signup', 'dashboard', 'settings', 'book', 'public',
    'manage-booking', 'booking-status', 'privacy-policy', 'terms-of-service', 'notifications',
    'clients', 'bookings', 'my-calendar', 'payment-invoice', 'u'];
const COOLDOWN_DAYS = 14;

// GET /api/profile-link
router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Check if about_me column exists
        const columnsResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'about_me'
        `);
        
        const hasAboutMe = columnsResult.rows.length > 0;
        
        const selectColumns = ['profile_slug', 'profile_slug_updated_at', 'plan_name'];
        if (hasAboutMe) selectColumns.push('about_me');
        
        const result = await pool.query(
            `SELECT ${selectColumns.join(', ')} FROM Users WHERE id = $1`,
            [req.user.id]
        );
        const row = result.rows[0];
        const nextEditAt = row?.profile_slug_updated_at
            ? new Date(new Date(row.profile_slug_updated_at).getTime() + COOLDOWN_DAYS * 86400000)
            : null;
        const canEdit = !nextEditAt || new Date() >= nextEditAt;

        res.json({
            profile_slug: row?.profile_slug || null,
            about_me: row?.about_me || null,
            next_edit_at: canEdit ? null : nextEditAt,
            plan_name: row?.plan_name || 'free',
        });
    } catch (err) {
        console.error('Error fetching profile link:', err.message);
        res.status(500).json({ error: 'Failed to fetch profile link' });
    }
});

// GET /api/profile-link/check/:slug
router.get('/check/:slug', isAuthenticated, async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    if (!SLUG_REGEX.test(slug)) {
        return res.json({ available: false, reason: 'Invalid format' });
    }
    if (RESERVED.includes(slug)) {
        return res.json({ available: false, reason: 'Reserved name' });
    }
    try {
        const result = await pool.query(
            'SELECT id FROM Users WHERE profile_slug = $1',
            [slug]
        );
        const takenByOther = result.rows.length > 0 && String(result.rows[0].id) !== String(req.user.id);
        res.json({ available: !takenByOther });
    } catch (err) {
        res.status(500).json({ error: 'Check failed' });
    }
});

// PUT /api/profile-link
router.put('/', isAuthenticated, async (req, res) => {
    const slug = (req.body.profile_slug || '').toLowerCase().trim();
    const aboutMe = (req.body.about_me || '').trim();

    if (!SLUG_REGEX.test(slug)) {
        return res.status(400).json({ error: 'Must be 4–50 characters, lowercase letters, numbers and hyphens only. Cannot start or end with a hyphen.' });
    }
    if (RESERVED.includes(slug)) {
        return res.status(400).json({ error: 'This name is reserved and cannot be used.' });
    }

    try {
        const userRes = await pool.query(
            'SELECT plan_name, profile_slug, profile_slug_updated_at FROM Users WHERE id = $1',
            [req.user.id]
        );
        const user = userRes.rows[0];

        if (user.plan_name !== 'enterprise') {
            return res.status(403).json({ error: 'Custom profile links are an Enterprise feature.' });
        }

        // Enforce 14-day cooldown (skip if first time setting)
        if (user.profile_slug && user.profile_slug_updated_at) {
            const nextEdit = new Date(new Date(user.profile_slug_updated_at).getTime() + COOLDOWN_DAYS * 86400000);
            if (new Date() < nextEdit) {
                return res.status(429).json({
                    error: `You can edit your profile link again on ${nextEdit.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
                    next_edit_at: nextEdit,
                });
            }
        }

        // Uniqueness check (excluding self)
        const conflict = await pool.query(
            'SELECT id FROM Users WHERE profile_slug = $1 AND id != $2',
            [slug, req.user.id]
        );
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'This profile link is already taken.' });
        }

        // Check if about_me column exists before updating
        const columnsResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'about_me'
        `);
        
        const hasAboutMe = columnsResult.rows.length > 0;
        
        if (hasAboutMe) {
            await pool.query(
                'UPDATE Users SET profile_slug = $1, about_me = $2, profile_slug_updated_at = NOW() WHERE id = $3',
                [slug, aboutMe || null, req.user.id]
            );
        } else {
            await pool.query(
                'UPDATE Users SET profile_slug = $1, profile_slug_updated_at = NOW() WHERE id = $2',
                [slug, req.user.id]
            );
        }

        const nextEditAt = new Date(Date.now() + COOLDOWN_DAYS * 86400000);
        res.json({ profile_slug: slug, about_me: aboutMe, next_edit_at: nextEditAt });
    } catch (err) {
        console.error('Error updating profile slug:', err.message);
        res.status(500).json({ error: 'Failed to update profile link' });
    }
});

// PUT /api/profile-link/about-me
// Allows updating about_me without cooldown restrictions
router.put('/about-me', isAuthenticated, async (req, res) => {
    const aboutMe = (req.body.about_me || '').trim();

    try {
        // Check if about_me column exists
        const columnsResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'about_me'
        `);
        
        const hasAboutMe = columnsResult.rows.length > 0;
        
        if (!hasAboutMe) {
            return res.status(400).json({ error: 'About Me feature is not available yet' });
        }

        await pool.query(
            'UPDATE Users SET about_me = $1 WHERE id = $2',
            [aboutMe || null, req.user.id]
        );

        res.json({ about_me: aboutMe, message: 'About Me updated successfully' });
    } catch (err) {
        console.error('Error updating about me:', err.message);
        res.status(500).json({ error: 'Failed to update about me' });
    }
});

export default router;
