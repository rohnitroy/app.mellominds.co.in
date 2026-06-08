import express from 'express';
import pool from '../config/database.js';
import devAdminOnly from '../middleware/devAdminOnly.js';
import { io } from '../server.js';

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
      WHERE account_status != 'deleted'
      GROUP BY plan_name
    `);

    // Total revenue from plan payments (paid minus refunds)
    const totalRevenue = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN payment_status = 'Refunded' THEN amount ELSE 0 END), 0) as total
      FROM plan_payments
      WHERE payment_status IN ('Paid', 'Refunded')
    `);

    // Total refunds from plan payments
    const totalRefunds = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM plan_payments
      WHERE payment_status = 'Refunded'
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

    // Active users - total users in application
    const activeUsers = await pool.query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE account_status != 'deleted'
    `);

    // Paid Individual Plan Users - only actual payments
    const paidIndividualUsers = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM plan_payments
      WHERE plan_name = 'individual' AND payment_status = 'Paid'
    `);

    // Paid Team Plan Users - only actual payments
    const paidTeamUsers = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM plan_payments
      WHERE plan_name = 'team' AND payment_status = 'Paid'
    `);

    // Individual Plan Users - paid + manually upgraded
    const individualPlanUsers = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count FROM (
        SELECT DISTINCT user_id FROM plan_payments
        WHERE plan_name = 'individual' AND payment_status = 'Paid'
        UNION
        SELECT id as user_id FROM users
        WHERE plan_name = 'individual' AND account_status != 'deleted'
      ) combined
    `);

    // Team Plan Users - paid + manually upgraded
    const teamPlanUsers = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count FROM (
        SELECT DISTINCT user_id FROM plan_payments
        WHERE plan_name = 'team' AND payment_status = 'Paid'
        UNION
        SELECT id as user_id FROM users
        WHERE plan_name = 'team' AND account_status != 'deleted'
      ) combined
    `);

    const paidIndividualCount = parseInt(paidIndividualUsers.rows[0].count) || 0;
    const paidTeamCount = parseInt(paidTeamUsers.rows[0].count) || 0;
    const paidPlanUsers = paidIndividualCount + paidTeamCount;
    const individualCount = parseInt(individualPlanUsers.rows[0].count) || 0;
    const teamCount = parseInt(teamPlanUsers.rows[0].count) || 0;

    res.json({
      usersByPlan: usersByPlan.rows,
      totalRevenue: totalRevenue.rows[0].total,
      totalRefunds: totalRefunds.rows[0].total,
      recentPayments: recentPayments.rows,
      activeUsers: activeUsers.rows[0].count,
      individualPlanUsers: individualCount,
      teamPlanUsers: teamCount,
      paidPlanUsers
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

    let whereClause = 'WHERE account_status != \'deleted\' AND email != \'mellomindsventure@gmail.com\'';
    const params = [];

    if (plan) {
      whereClause += ' AND plan_name = $' + (params.length + 1);
      params.push(plan);
    }

    if (search) {
      whereClause += ' AND (email ILIKE $' + (params.length + 1) + ' OR user_name ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    const city = req.query.city || null;
    if (city) {
      whereClause += ' AND city = $' + (params.length + 1);
      params.push(city);
    }

    const status = req.query.status || null;
    if (status) {
      if (status === 'Active') {
        whereClause += ' AND account_status = \'active\' AND last_login >= NOW() - INTERVAL \'7 days\'';
      } else if (status === 'Inactive') {
        whereClause += ' AND account_status = \'active\' AND (last_login IS NULL OR last_login < NOW() - INTERVAL \'7 days\')';
      } else if (status === 'Banned') {
        whereClause += ' AND account_status = \'banned\'';
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get paginated data
    const query = `SELECT id, user_name, email, phone, city, plan_name, created_at, account_status, last_login FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];
    const result = await pool.query(query, dataParams);

    // Get paid users for isPaidUser flag
    const userIds = result.rows.map(u => u.id);
    let paidUserIds = [];
    if (userIds.length > 0) {
      const paidResult = await pool.query(
        `SELECT DISTINCT user_id FROM plan_payments WHERE user_id = ANY($1) AND payment_status = 'Paid'`,
        [userIds]
      );
      paidUserIds = paidResult.rows.map(r => r.user_id);
    }

    // Add isPaidUser flag to each user
    const usersWithFlag = result.rows.map(user => ({
      ...user,
      isPaidUser: paidUserIds.includes(user.id)
    }));

    res.json({
      users: usersWithFlag,
      limit,
      offset,
      total: totalCount
    });
  } catch (err) {
    console.error('All users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/dev/payments - Plan payments with filters
router.get('/payments', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    let query = `
      SELECT pp.id, u.user_name, pp.amount as payment_amount, pp.plan_name, pp.payment_status, pp.payment_method, pp.created_at
      FROM plan_payments pp
      JOIN users u ON pp.user_id = u.id
      WHERE 1=1
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
    const { plan_name, purchased_seats, org_role } = req.body;

    if (!['free', 'individual', 'team', 'enterprise'].includes(plan_name)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Update user plan
    let updateQuery = 'UPDATE users SET plan_name = $1';
    const params = [plan_name, id];

    if (plan_name === 'team') {
      if (purchased_seats && (purchased_seats < 3 || purchased_seats > 20)) {
        return res.status(400).json({ error: 'Seats must be between 3 and 20' });
      }
      updateQuery += `, purchased_seats = $${params.length + 1}, org_role = $${params.length + 2}`;
      params.push(purchased_seats || 3, org_role || 'owner');
    }

    updateQuery += ` WHERE id = $2 RETURNING id, user_name, email, plan_name, purchased_seats`;

    const result = await pool.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Record plan payment
    const user = result.rows[0];
    const amount = plan_name === 'individual' ? 699 : plan_name === 'team' ? (purchased_seats || 3) * 1499 : 0;

    if (amount > 0) {
      await pool.query(
        `INSERT INTO plan_payments (user_id, plan_name, amount, payment_status, created_at)
         VALUES ($1, $2, $3, 'Paid', NOW())`,
        [id, plan_name, amount]
      );
    }

    // Emit real-time update
    io.emit('plan-changed', { userId: id, plan: newPlan, user });

    res.json({ message: 'Plan updated', user });
  } catch (err) {
    console.error('Change plan error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// POST /api/dev/user/:id/suspend - Ban user account
router.post('/user/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE users SET account_status = \'banned\' WHERE id = $1 RETURNING id, user_name, email, account_status',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Emit real-time update
    io.emit('user-banned', { userId: id, user: result.rows[0] });

    res.json({ message: 'User suspended', user: result.rows[0] });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// POST /api/dev/user/:id/unban - Unban user account
router.post('/user/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE users SET account_status = \'active\' WHERE id = $1 RETURNING id, user_name, email, account_status',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Emit real-time update
    io.emit('user-unbanned', { userId: id, user: result.rows[0] });

    res.json({ message: 'User unbanned', user: result.rows[0] });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// POST /api/dev/user/:id/cancel-plan - Cancel user plan and optionally refund
router.post('/user/:id/cancel-plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { issueRefund } = req.body;

    // Get current user plan
    const userResult = await pool.query('SELECT id, plan_name FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const currentPlan = user.plan_name;

    // Get paid amount for refund
    let refundAmount = 0;
    if (issueRefund) {
      const paymentResult = await pool.query(
        `SELECT amount FROM plan_payments WHERE user_id = $1 AND payment_status = 'Paid' ORDER BY created_at DESC LIMIT 1`,
        [id]
      );
      if (paymentResult.rows.length > 0) {
        refundAmount = paymentResult.rows[0].amount;

        // Record refund in plan_payments
        await pool.query(
          `INSERT INTO plan_payments (user_id, plan_name, amount, payment_status, created_at)
           VALUES ($1, $2, $3, 'Refunded', NOW())`,
          [id, currentPlan, refundAmount]
        );
      }
    }

    // Change plan to free
    const updateResult = await pool.query(
      'UPDATE users SET plan_name = \'free\', purchased_seats = NULL WHERE id = $1 RETURNING id, user_name, email, plan_name',
      [id]
    );

    // Emit real-time update
    io.emit('plan-cancelled', { userId: id, plan: 'free', refunded: issueRefund, refundAmount });

    res.json({ message: 'Plan cancelled', user: updateResult.rows[0], refunded: issueRefund, refundAmount });
  } catch (err) {
    console.error('Cancel plan error:', err);
    res.status(500).json({ error: 'Failed to cancel plan' });
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

// GET /api/dev/cities - Get distinct cities for filter
router.get('/cities', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT city FROM users
       WHERE account_status != 'deleted' AND city IS NOT NULL AND city != ''
       ORDER BY city ASC`
    );
    const cities = result.rows.map(r => r.city);
    res.json({ cities });
  } catch (err) {
    console.error('Cities error:', err);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// GET /api/dev/settings - Fetch system settings
router.get('/settings', async (req, res) => {
  try {
    res.json({
      maxTeamSeats: 20,
      freeAnalyticsDays: 90,
      devAdminEmails: ['mellomindsventure@gmail.com']
    });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

export default router;
