import { Router } from 'express';
import pool from '../config/database.js';

const router = Router();

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// GET /api/notifications - Get admin notifications
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type || null;

    let query = `
      SELECT id, type, title, message, user_id, user_name, is_read, created_at
      FROM admin_notifications
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND type = $' + (params.length + 1);
      params.push(type);
    }

    // Get total count
    const countQuery = query.replace('SELECT id, type, title, message, user_id, user_name, is_read, created_at', 'SELECT COUNT(*) as total');
    const countResult = await pool.query(countQuery, params);

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0]?.total) || 0,
      limit,
      offset
    });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post('/:id/read', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE admin_notifications SET is_read = TRUE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

export default router;
