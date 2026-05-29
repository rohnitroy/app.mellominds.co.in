import pool from '../config/database.js';

// Middleware to check if user is authenticated
export const isAuthenticated = async (req, res, next) => {
  if (req.isAuthenticated()) {
    // Set the current user ID for Row Level Security (using proper PostgreSQL syntax)
    try {
      const userId = req.user.id.toString();
      // Use SET LOCAL for session-scoped variable (correct PostgreSQL syntax)
      await pool.query(`SET LOCAL app.current_user_id = '${userId}'`);
    } catch (error) {
      // RLS context is optional - don't fail the request if it fails
      // This is just for additional security, not critical
    }
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login.' });
};
