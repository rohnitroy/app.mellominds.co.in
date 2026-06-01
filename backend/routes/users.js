// User management API
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Middleware to ensure authentication
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

/**
 * GET /api/users/me
 * Get current authenticated user
 */
router.get('/me', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT id, email, user_name, phone, plan_name, org_role, org_owner_id, 
              dob, gender, language_spoken, country, state, city, pincode, 
              clinic_address, profile_picture, profile_slug, specialization, 
              created_at, updated_at
       FROM Users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/users/:id
 * Get a specific user by ID
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT id, email, user_name, phone, plan_name, org_role, org_owner_id, 
              dob, gender, language_spoken, country, state, city, pincode, 
              clinic_address, profile_picture, profile_slug, specialization, 
              created_at, updated_at
       FROM Users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { user_name, phone, dob, gender, language_spoken, country, state, city, pincode, clinic_address, specialization } = req.body;

    const result = await pool.query(
      `UPDATE Users
       SET user_name = COALESCE($1, user_name),
           phone = COALESCE($2, phone),
           dob = COALESCE($3, dob),
           gender = COALESCE($4, gender),
           language_spoken = COALESCE($5, language_spoken),
           country = COALESCE($6, country),
           state = COALESCE($7, state),
           city = COALESCE($8, city),
           pincode = COALESCE($9, pincode),
           clinic_address = COALESCE($10, clinic_address),
           specialization = COALESCE($11, specialization),
           is_therapist = CASE WHEN $11 IS NOT NULL THEN true ELSE is_therapist END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING id, email, user_name, phone, plan_name, org_role, org_owner_id,
                 dob, gender, language_spoken, country, state, city, pincode,
                 clinic_address, profile_picture, profile_slug, specialization,
                 is_therapist, created_at, updated_at`,
      [user_name, phone, dob, gender, language_spoken, country, state, city, pincode, clinic_address, specialization, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * GET /api/users
 * List all users (admin/enterprise owner only)
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Only allow enterprise owners to list users
    if (req.user.plan_name !== 'enterprise' || req.user.org_role === 'member') {
      return res.status(403).json({ error: 'Unauthorized - Enterprise owner access required' });
    }

    const result = await pool.query(
      `SELECT id, email, user_name, phone, plan_name, org_role, org_owner_id, 
              created_at, updated_at
       FROM Users
       WHERE org_owner_id = $1 OR id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
