import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

// GET /api/calendars/public/:userId/:slug
router.get('/public/:userId/:slug', async (req, res) => {
    try {
        const { userId, slug } = req.params;
        const result = await pool.query(
            `SELECT c.*, u.user_name as therapist_name, u.email as therapist_email, u.profile_picture 
             FROM Calendars c
             JOIN Users u ON c.user_id = u.id
             WHERE c.user_id = $1 AND (c.slug = $2 OR c.slug = $3) AND c.is_active = true`,
            [userId, slug, slug.startsWith('/') ? slug : `/${slug}`]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching public calendar:', error);
        res.status(500).json({ error: 'Failed to fetch calendar' });
    }
});

router.use(ensureAuthenticated);

// GET /api/calendars
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM Calendars WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching calendars:', error);
        res.status(500).json({ error: 'Failed to fetch calendars' });
    }
});

// POST /api/calendars
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, duration, type, description, slug, form_data, payment_data } = req.body;

        if (!title || !duration || !type) {
            return res.status(400).json({ error: 'Title, duration, and type are required' });
        }

        const finalSlug = slug || `/${title.toLowerCase().replace(/ /g, '-')}-${Date.now()}`;

        const result = await pool.query(
            `INSERT INTO Calendars 
                (user_id, title, duration, type, description, slug, form_data,
                 payment_enabled, payment_gateway, prices, cancellation_policy, reschedule_policy) 
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) 
             RETURNING *`,
            [
                userId, title, duration, type, description, finalSlug,
                form_data ? JSON.stringify(form_data) : null,
                payment_data?.acceptPayment || false,
                payment_data?.paymentGateways?.[0] || null,
                payment_data?.prices?.length ? JSON.stringify(payment_data.prices) : null,
                payment_data?.cancellation ? JSON.stringify(payment_data.cancellation) : null,
                payment_data?.reschedule ? JSON.stringify(payment_data.reschedule) : null
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating calendar:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'Calendar with this slug already exists' });
        res.status(500).json({ error: 'Failed to create calendar' });
    }
});

// PUT /api/calendars/:id
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const calendarId = req.params.id;
        const { title, duration, type, description, slug, is_active, form_data, payment_data } = req.body;

        const fields = [];
        const values = [];

        const add = (col, val) => { values.push(val); fields.push(`${col} = $${values.length}`); };

        if (title !== undefined) add('title', title);
        if (duration !== undefined) add('duration', duration);
        if (type !== undefined) add('type', type);
        if (description !== undefined) add('description', description);
        if (is_active !== undefined) add('is_active', is_active);
        if (form_data !== undefined) add('form_data', JSON.stringify(form_data));
        if (slug !== undefined) add('slug', slug.startsWith('/') ? slug : `/${slug}`);

        if (payment_data !== undefined) {
            add('payment_enabled', payment_data.acceptPayment || false);
            add('payment_gateway', payment_data.paymentGateways?.[0] || null);
            add('prices', payment_data.prices?.length ? JSON.stringify(payment_data.prices) : null);
            add('cancellation_policy', payment_data.cancellation ? JSON.stringify(payment_data.cancellation) : null);
            add('reschedule_policy', payment_data.reschedule ? JSON.stringify(payment_data.reschedule) : null);
        }

        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

        values.push(calendarId, userId);
        const idIdx = values.length - 1;
        const uidIdx = values.length;

        const result = await pool.query(
            `UPDATE Calendars SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${idIdx} AND user_id = $${uidIdx} RETURNING *`,
            values
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar not found or unauthorized' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating calendar:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'Calendar with this slug already exists' });
        res.status(500).json({ error: 'Failed to update calendar' });
    }
});

// DELETE /api/calendars/:id
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM Calendars WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar not found or unauthorized' });
        res.json({ message: 'Calendar deleted successfully' });
    } catch (error) {
        console.error('Error deleting calendar:', error);
        res.status(500).json({ error: 'Failed to delete calendar' });
    }
});

export default router;
