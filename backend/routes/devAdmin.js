import express from 'express';
import pool from '../config/database.js';
import devAdminOnly from '../middleware/devAdminOnly.js';
import { io } from '../server.js';
import { logNotification } from '../lib/notifications.js';

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

// GET /api/dev/payments - Plan payments with filters & search
router.get('/payments', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';
    const status = req.query.status || null;
    const plan = req.query.plan || null;

    let query = `
      SELECT pp.id, u.user_name, pp.amount as payment_amount, pp.plan_name, pp.payment_status, pp.payment_method, pp.created_at
      FROM plan_payments pp
      JOIN users u ON pp.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = `SELECT COUNT(*) as total FROM plan_payments pp JOIN users u ON pp.user_id = u.id WHERE 1=1`;
    const params = [];

    if (search) {
      const searchParam = `%${search}%`;
      query += ' AND (u.user_name ILIKE $' + (params.length + 1) + ' OR pp.amount::text ILIKE $' + (params.length + 1) + ')';
      countQuery += ' AND (u.user_name ILIKE $' + (params.length + 1) + ' OR pp.amount::text ILIKE $' + (params.length + 1) + ')';
      params.push(searchParam);
    }

    if (status) {
      query += ' AND pp.payment_status = $' + (params.length + 1);
      countQuery += ' AND pp.payment_status = $' + (params.length + 1);
      params.push(status);
    }

    if (plan) {
      query += ' AND pp.plan_name = $' + (params.length + 1);
      countQuery += ' AND pp.plan_name = $' + (params.length + 1);
      params.push(plan);
    }

    query += ' ORDER BY pp.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    res.json({
      payments: result.rows,
      total: parseInt(countResult.rows[0]?.total) || 0,
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

    // Log admin notification
    await logNotification(
      'plan_upgrade',
      `Plan Upgraded to ${plan_name.charAt(0).toUpperCase() + plan_name.slice(1)}`,
      `User's plan changed to ${plan_name}${plan_name === 'team' ? ` with ${purchased_seats || 3} seats` : ''}`,
      id,
      user.user_name,
      { plan_name, amount, purchased_seats }
    );

    // Emit real-time update
    io.emit('plan-changed', { userId: id, plan: plan_name, user });

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

    const user = result.rows[0];

    // Log admin notification
    await logNotification(
      'user_banned',
      'User Banned',
      `${user.user_name} has been banned from the platform`,
      id,
      user.user_name,
      { reason: 'Admin action' }
    );

    // Emit real-time update
    io.emit('user-banned', { userId: id, user });

    res.json({ message: 'User suspended', user });
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

    const user = result.rows[0];

    // Log admin notification
    await logNotification(
      'user_unbanned',
      'User Unbanned',
      `${user.user_name} has been unbanned and can access the platform`,
      id,
      user.user_name,
      { action: 'unban' }
    );

    // Emit real-time update
    io.emit('user-unbanned', { userId: id, user });

    res.json({ message: 'User unbanned', user });
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

    const updatedUser = updateResult.rows[0];

    // Log admin notification
    await logNotification(
      'plan_cancelled',
      'Plan Cancelled',
      `${updatedUser.user_name}'s ${currentPlan} plan has been cancelled${issueRefund ? ` and refunded ₹${refundAmount}` : ''}`,
      id,
      updatedUser.user_name,
      { previousPlan: currentPlan, refunded: issueRefund, refundAmount }
    );

    // Emit real-time update
    io.emit('plan-cancelled', { userId: id, plan: 'free', refunded: issueRefund, refundAmount });

    res.json({ message: 'Plan cancelled', user: updatedUser, refunded: issueRefund, refundAmount });
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

// Helper function to format hours to "Xh Ym" format
const formatTimeSpend = (hours) => {
  const h = Math.floor(parseFloat(hours));
  const m = Math.round((parseFloat(hours) - h) * 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// GET /api/dev/user/:id/detail - User detail view
router.get('/user/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;

    // Get user info
    const userResult = await pool.query(
      `SELECT id, user_name, email, phone, city, plan_name, created_at, last_login, account_status, purchased_seats
       FROM users WHERE id = $1 AND account_status != 'deleted'`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get client count from clients table (all clients under this therapist)
    const clientCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM clients
       WHERE therapist_id = $1`,
      [id]
    );
    const clientCount = parseInt(clientCountResult.rows[0]?.count) || 0;

    // Get session stats from user_sessions table (if table exists)
    let totalSessions = 0, dailyAvgMinutes = 0, avgSessionMinutes = 0, totalMinutes = 0;

    try {
      const totalSessionsRes = await pool.query(
        `SELECT COUNT(*) as count FROM user_sessions
         WHERE user_id = $1 AND logout_time IS NOT NULL`,
        [id]
      );
      totalSessions = parseInt(totalSessionsRes.rows[0]?.count) || 0;

      // Get total time spent (last 7 days for daily avg)
      const dailyRes = await pool.query(
        `SELECT COALESCE(SUM(duration_minutes), 0) as total
         FROM user_sessions
         WHERE user_id = $1 AND logout_time IS NOT NULL AND login_time >= NOW() - INTERVAL '7 days'`,
        [id]
      );
      const last7DaysMinutes = parseInt(dailyRes.rows[0]?.total) || 0;
      dailyAvgMinutes = last7DaysMinutes > 0 ? Math.round(last7DaysMinutes / 7) : 0;

      // Get average time per session
      const avgSessionRes = await pool.query(
        `SELECT COALESCE(SUM(duration_minutes), 0) as total
         FROM user_sessions
         WHERE user_id = $1 AND logout_time IS NOT NULL`,
        [id]
      );
      totalMinutes = parseInt(avgSessionRes.rows[0]?.total) || 0;
      avgSessionMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
    } catch (err) {
      // user_sessions table might not exist yet, fallback to 0
      console.warn('Session stats unavailable:', err.message);
    }

    // Format time helper
    const formatTime = (minutes) => {
      if (!minutes || minutes < 1) return '0m';
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    // Check if user is paid
    const paidResult = await pool.query(
      `SELECT COUNT(*) as count FROM plan_payments
       WHERE user_id = $1 AND payment_status = 'Paid'`,
      [id]
    );
    const isPaidUser = parseInt(paidResult.rows[0]?.count) || 0 > 0;

    res.json({
      user: {
        ...user,
        id: user.id,
        user_name: user.user_name || '',
        email: user.email || '',
        phone: user.phone || '',
        city: user.city || '',
        plan_name: user.plan_name || 'free',
        created_at: user.created_at,
        last_login: user.last_login,
        account_status: user.account_status,
        purchased_seats: user.purchased_seats || null
      },
      clientCount: clientCount || 0,
      dailyTimeSpend: formatTime(dailyAvgMinutes),
      avgTimeSpend: formatTime(avgSessionMinutes),
      totalSessions: totalSessions,
      totalMinutes: totalMinutes,
      isPaidUser: isPaidUser
    });
  } catch (err) {
    console.error('User detail error:', err);
    res.status(500).json({ error: 'Failed to fetch user detail' });
  }
});

// PUT /api/dev/user/:id - Update user profile
router.put('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_name, email, phone, city } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET user_name = COALESCE($1, user_name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           city = COALESCE($4, city)
       WHERE id = $5 AND account_status != 'deleted'
       RETURNING id, user_name, email, phone, city, plan_name, created_at, last_login, account_status`,
      [user_name || null, email || null, phone || null, city || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result.rows[0];
    const changes = [];
    if (user_name) changes.push(`name: ${user_name}`);
    if (email) changes.push(`email: ${email}`);
    if (phone) changes.push(`phone: ${phone}`);
    if (city) changes.push(`city: ${city}`);

    // Log admin notification
    await logNotification(
      'user_profile_updated',
      'User Profile Updated',
      `${updatedUser.user_name}'s profile updated: ${changes.join(', ')}`,
      id,
      updatedUser.user_name,
      { changes }
    );

    // Emit real-time update
    io.emit('user-updated', { userId: id, user: updatedUser });

    res.json({ message: 'User updated', user: updatedUser });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
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
