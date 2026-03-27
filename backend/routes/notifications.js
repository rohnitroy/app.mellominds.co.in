import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

// GET /api/notifications - fetch all notifications for current user
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM Notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COUNT(*) FROM Notifications WHERE user_id = $1 AND is_read = false`,
            [req.user.id]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// PUT /api/notifications/:id/read - mark single notification as read
router.put('/:id/read', async (req, res) => {
    try {
        await pool.query(
            `UPDATE Notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// PUT /api/notifications/read-all - mark all as read
router.put('/read-all', async (req, res) => {
    try {
        await pool.query(
            `UPDATE Notifications SET is_read = true WHERE user_id = $1`,
            [req.user.id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

export default router;
