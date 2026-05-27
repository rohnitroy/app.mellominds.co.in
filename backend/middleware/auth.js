import pool from '../config/database.js';

// Middleware to check if user is authenticated
export const isAuthenticated = async (req, res, next) => {
  if (req.isAuthenticated()) {
    // Set the current user ID for Row Level Security (using proper PostgreSQL syntax)
    try {
      const userId = req.user.id.toString();
      await pool.query(`SET app.current_user_id = $1`, [userId]);
    } catch (error) {
      console.error('Failed to set RLS user context:', error);
      // Don't fail the request if RLS context setting fails
    }
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login.' });
};
