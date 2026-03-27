import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

// GET /api/activities/:clientId
router.get('/:clientId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM ClientActivities WHERE client_id = $1 AND therapist_id = $2 ORDER BY created_at DESC`,
            [req.params.clientId, req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// POST /api/activities
router.post('/', async (req, res) => {
    try {
        const { client_id, name, description, visible_to_client } = req.body;
        if (!client_id || !name) {
            return res.status(400).json({ error: 'client_id and name are required' });
        }
        const result = await pool.query(
            `INSERT INTO ClientActivities (client_id, therapist_id, name, description, visible_to_client)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [client_id, req.user.id, name, description || null, visible_to_client || false]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({ error: 'Failed to create activity' });
    }
});

// DELETE /api/activities/:id
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM ClientActivities WHERE id = $1 AND therapist_id = $2 RETURNING id`,
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ error: 'Failed to delete activity' });
    }
});

export default router;
