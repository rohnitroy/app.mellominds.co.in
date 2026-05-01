import pool from '../config/database.js';

// Middleware to check if user is authenticated
export const isAuthenticated = async (req, res, next) => {
  if (req.isAuthenticated()) {
    // Set the current user ID for Row Level Security
    try {
      await pool.query('SET app.current_user_id = $1', [req.user.id]);
    } catch (error) {
      console.error('Failed to set RLS user context:', error);
      // Don't fail the request if RLS context setting fails
    }
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login.' });
};
