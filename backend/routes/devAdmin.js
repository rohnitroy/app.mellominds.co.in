import express from 'express';
import pool from '../config/database.js';
import devAdminOnly from '../middleware/devAdminOnly.js';

const router = express.Router();

// All routes require dev admin authentication
router.use(devAdminOnly);

// GET /api/dev/dashboard - Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    // Total users by plan
    const usersByPlan = await pool.query(`
      SELECT plan_name, COUNT(*) as count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY plan_name
    `);

    // Total revenue (sum of all paid appointments)
    const totalRevenue = await pool.query(`
      SELECT COALESCE(SUM(payment_amount), 0) as total
      FROM appointments
      WHERE payment_status = 'Paid'
    `);

    // Recent payments (last 10)
    const recentPayments = await pool.query(`
      SELECT a.id, u.user_name, a.payment_amount, u.plan_name, a.payment_status, a.created_at
      FROM appointments a
      JOIN users u ON a.therapist_id = u.id
      WHERE a.payment_status IN ('Paid', 'Refunded', 'Pending')
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    // Active users (logged in last 7 days)
    const activeUsers = await pool.query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE last_login >= NOW() - INTERVAL '7 days' AND deleted_at IS NULL
    `);

    res.json({
      usersByPlan: usersByPlan.rows,
      totalRevenue: totalRevenue.rows[0].total,
      recentPayments: recentPayments.rows,
      activeUsers: activeUsers.rows[0].count
    });
  } catch (err) {
    console.error('Dev dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/dev/all-users - All users list with pagination
router.get('/all-users', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const plan = req.query.plan || null;
    const search = req.query.search || null;

    let whereClause = 'WHERE deleted_at IS NULL';
    const params = [];

    if (plan) {
      whereClause += ' AND plan_name = $' + (params.length + 1);
      params.push(plan);
    }

    if (search) {
      whereClause += ' AND (email ILIKE $' + (params.length + 1) + ' OR user_name ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get paginated data
    const query = `SELECT id, user_name, email, plan_name, created_at, last_login FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];
    const result = await pool.query(query, dataParams);

    res.json({
      users: result.rows,
      limit,
      offset,
      total: totalCount
    });
  } catch (err) {
    console.error('All users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/dev/payments - All payments with filters
router.get('/payments', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    let query = `
      SELECT a.id, u.user_name, a.payment_amount, u.plan_name, a.payment_status, a.payment_method, a.created_at
      FROM appointments a
      JOIN users u ON a.therapist_id = u.id
      WHERE a.payment_amount > 0
    `;
    const params = [];

    if (status) {
      query += ' AND a.payment_status = $' + (params.length + 1);
      params.push(status);
    }

    if (startDate) {
      query += ' AND a.created_at >= $' + (params.length + 1);
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND a.created_at <= $' + (params.length + 1);
      params.push(endDate);
    }

    query += ' ORDER BY a.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      payments: result.rows,
      limit,
      offset
    });
  } catch (err) {
    console.error('Payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/dev/user/:id/change-plan - Change user's plan
router.post('/user/:id/change-plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_name } = req.body;

    if (!['free', 'individual', 'team', 'enterprise'].includes(plan_name)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const result = await pool.query(
      'UPDATE users SET plan_name = $1 WHERE id = $2 RETURNING id, user_name, email, plan_name',
      [plan_name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Plan updated', user: result.rows[0] });
  } catch (err) {
    console.error('Change plan error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// POST /api/dev/user/:id/suspend - Suspend user account
router.post('/user/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 RETURNING id, user_name, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User suspended', user: result.rows[0] });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// POST /api/dev/refund - Manual refund issuance
router.post('/refund', async (req, res) => {
  try {
    const { appointment_id, amount, reason } = req.body;

    // Record refund
    await pool.query(
      `INSERT INTO refund_tracking (appointment_id, refund_amount, reason, refund_date, refund_status)
       VALUES ($1, $2, $3, NOW(), 'Processed')`,
      [appointment_id, amount, reason]
    );

    // Update appointment status
    await pool.query(
      'UPDATE appointments SET payment_status = $1, refund_amount = $2 WHERE id = $3',
      ['Refunded', amount, appointment_id]
    );

    res.json({ message: 'Refund processed' });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// GET /api/dev/settings - Fetch system settings
router.get('/settings', async (req, res) => {
  try {
    res.json({
      maxTeamSeats: 20,
      freeAnalyticsDays: 90,
      devAdminEmails: ['adosolve@gmail.com']
    });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

export default router;
