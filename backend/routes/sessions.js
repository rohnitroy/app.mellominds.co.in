import { Router } from 'express';
import pool from '../config/database.js';

const router = Router();

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Not logged in' });
  }
};

// POST /api/sessions/start - Record session start
router.post('/start', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, login_time)
       VALUES ($1, NOW())
       RETURNING id, login_time`,
      [userId]
    );

    res.json({ sessionId: result.rows[0].id, loginTime: result.rows[0].login_time });
  } catch (err) {
    console.error('Session start error:', err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// POST /api/sessions/end - Record session end
router.post('/end', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, durationMinutes } = req.body;

    if (!sessionId || durationMinutes === undefined) {
      return res.status(400).json({ error: 'Missing sessionId or durationMinutes' });
    }

    const result = await pool.query(
      `UPDATE user_sessions
       SET logout_time = NOW(), duration_minutes = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, duration_minutes`,
      [durationMinutes, sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ sessionId: result.rows[0].id, durationMinutes: result.rows[0].duration_minutes });
  } catch (err) {
    console.error('Session end error:', err);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// GET /api/sessions/stats/:userId - Get user session stats
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Total sessions
    const totalRes = await pool.query(
      `SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND logout_time IS NOT NULL`,
      [userId]
    );
    const totalSessions = parseInt(totalRes.rows[0]?.count) || 0;

    // Total time in minutes
    const totalTimeRes = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total FROM user_sessions
       WHERE user_id = $1 AND logout_time IS NOT NULL`,
      [userId]
    );
    const totalMinutes = parseInt(totalTimeRes.rows[0]?.total) || 0;

    // Average time per session
    const avgMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    // Daily average (last 7 days)
    const dailyRes = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total
       FROM user_sessions
       WHERE user_id = $1
         AND logout_time IS NOT NULL
         AND login_time >= NOW() - INTERVAL '7 days'`,
      [userId]
    );
    const last7DaysMinutes = parseInt(dailyRes.rows[0]?.total) || 0;
    const dailyAvgMinutes = last7DaysMinutes > 0 ? Math.round(last7DaysMinutes / 7) : 0;

    // Format time as "Xh Ym" or "Xm"
    const formatTime = (minutes) => {
      if (!minutes || minutes < 1) return '0m';
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    res.json({
      totalSessions,
      totalMinutes,
      avgMinutesPerSession: avgMinutes,
      avgTimeSpend: formatTime(avgMinutes),
      dailyAvgMinutes,
      dailyTimeSpend: formatTime(dailyAvgMinutes),
      last7DaysMinutes
    });
  } catch (err) {
    console.error('Session stats error:', err);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
});

export default router;
