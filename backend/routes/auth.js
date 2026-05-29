import express from 'express';
import passport from '../config/passport.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/database.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { sendEmail, passwordResetEmail, newUserAlertEmail } from '../lib/email.js';
import { sanitizeStr, isValidEmail } from '../middleware/sanitize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for memory storage (Cloudinary upload)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit for profile images
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Registration endpoint
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, dateOfBirth, gender, specialization, languages, country, state, city, pincode, address } = req.body;

    // Validate and sanitize inputs
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (password.length > 128) {
      return res.status(400).json({ error: 'Password too long.' });
    }
    const sanitizedName = sanitizeStr(fullName, 100);
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Invalid name.' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Capitalize gender to match DB constraint
    const formattedGender = gender ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase() : null;

    // Convert languages to array if it's a string
    const languagesArray = languages ? (Array.isArray(languages) ? languages : languages.split(',').map(l => l.trim())) : [];

    // Insert user into database
    const result = await pool.query(
      `INSERT INTO users (user_name, email, password_hash, phone, dob, gender, specialization, language_spoken, country, state, city, pincode, clinic_address, auth_provider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, user_name, email`,
      [fullName, email, hashedPassword, phoneNumber || null, dateOfBirth || null, formattedGender, specialization || null, languagesArray, country || null, state || null, city || null, pincode || null, address || null, 'email']
    );

    // Fire-and-forget: notify team of new user signup
    const alertEmail = newUserAlertEmail({ userName: fullName, email, authProvider: 'email' });
    try {
      await sendEmail({ to: 'sarafaastha13@gmail.com', cc: 'adosolve@gmail.com,mellomindsventure@gmail.com', ...alertEmail });
    } catch (err) {
      console.error('New user alert email failed:', err.message);
    }

    const newUserId = result.rows[0].id;

    // Handle invite token — grant enterprise member role if valid
    const inviteToken = req.body.inviteToken;
    if (inviteToken && typeof inviteToken === 'string') {
      try {
        const inviteRes = await pool.query(
          `SELECT id, owner_id FROM organization_therapists
           WHERE invite_token = $1 AND LOWER(invite_email) = $2
             AND status = 'pending' AND invite_expires_at > NOW()`,
          [inviteToken.trim(), email]
        );
        if (inviteRes.rows.length > 0) {
          const { id: inviteId, owner_id } = inviteRes.rows[0];
          await pool.query(
            `UPDATE users SET plan_name = 'enterprise', org_role = 'member', org_owner_id = $1 WHERE id = $2`,
            [owner_id, newUserId]
          );
          await pool.query(
            `UPDATE organization_therapists SET status = 'active', therapist_user_id = $1, invite_token = NULL WHERE id = $2`,
            [newUserId, inviteId]
          );
        }
      } catch (inviteErr) {
        console.error('Invite token processing failed (non-fatal):', inviteErr.message);
      }
    }

    res.status(201).json({ message: 'Registration successful', user: result.rows[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Traditional email/password login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user registered with Google (no password_hash)
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Please login with Google' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Login user (create session)
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json({ message: 'Login successful', user: userWithoutPassword });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initiate Google OAuth login
router.get('/google', (req, res, next) => {
  console.log('[DEBUG] /auth/google route called');
  console.log('[DEBUG] Frontend URL:', process.env.FRONTEND_URL);
  console.log('[DEBUG] Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing');
  console.log('[DEBUG] Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
  console.log('[DEBUG] Google Callback URL:', process.env.GOOGLE_CALLBACK_URL);
  
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback', (req, res, next) => {
  console.log('[DEBUG] Google callback received');
  console.log('[DEBUG] Query params:', req.query);
  
  passport.authenticate('google', (err, user, info) => {
    console.log('[DEBUG] Passport authenticate callback called');
    console.log('[DEBUG] Error:', err);
    console.log('[DEBUG] User:', user ? `id=${user.id}` : 'null');
    console.log('[DEBUG] Info:', info);
    
    if (err) {
      console.error('[DEBUG] Google Auth Error:', err);
      console.error('[DEBUG] Error message:', err.message);
      console.error('[DEBUG] Error stack:', err.stack);
      // Check for specific error types if needed
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed_server&details=${encodeURIComponent(err.message)}`);
    }
    if (!user) {
      console.error('[DEBUG] Google Auth Failed: No user returned', info);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed_nouser`);
    }
    console.log('[DEBUG] Google Auth Success: user id =', user.id);
    req.logIn(user, (err) => {
      if (err) {
        console.error('[DEBUG] Session Save Error:', err);
        console.error('[DEBUG] Session Save Error message:', err.message);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_error`);
      }

      console.log('[DEBUG] Session saved successfully');
      // Check if user has completed profile
      if (!user.phone) {
        console.log('[DEBUG] Redirecting to profile completion');
        return res.redirect(`${process.env.FRONTEND_URL}/complete-profile`);
      }
      console.log('[DEBUG] Redirecting to dashboard');
      return res.redirect(`${process.env.FRONTEND_URL}/`);
    });
  })(req, res, next);
});

// Complete profile endpoint
router.post('/complete-profile', async (req, res) => {
  // Check if user is authenticated
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userId = req.user.id;
    const { phoneNumber, dateOfBirth, gender, specialization, languages, country, state, city, pincode, address } = req.body;

    // Validate required fields
    if (!phoneNumber || !dateOfBirth) {
      return res.status(400).json({ error: 'Phone number and Date of Birth are required' });
    }

    // Capitalize gender to match DB constraint
    const formattedGender = gender ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase() : null;

    // Convert languages to array if it's a string
    const languagesArray = languages ? (Array.isArray(languages) ? languages : languages.split(',').map(l => l.trim())) : [];

    // Update user in database
    const result = await pool.query(
      `UPDATE users 
       SET phone = $1, dob = $2, gender = $3, specialization = $4, language_spoken = $5, 
           country = $6, state = $7, city = $8, pincode = $9, clinic_address = $10 
       WHERE id = $11 
       RETURNING *`,
      [phoneNumber, dateOfBirth, formattedGender, specialization || null, languagesArray, country, state, city, pincode, address, userId]
    );

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// POST /auth/forgot-password - Send a secure reset link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });

    const result = await pool.query('SELECT id, auth_provider FROM users WHERE email = $1', [email]);

    // Always return the same message to prevent email enumeration
    const genericMsg = { message: 'If this email is registered, a reset link has been sent.' };

    if (result.rows.length === 0) return res.json(genericMsg);

    const user = result.rows[0];
    if (user.auth_provider === 'google') {
      return res.status(400).json({ error: 'This account uses Google login. Please sign in with Google.' });
    }

    // Generate a secure random token, store its hash, expire in 30 minutes
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [tokenHash, expires, user.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    const emailContent = passwordResetEmail({ resetUrl });
    await sendEmail({ to: email, ...emailContent });

    res.json(genericMsg);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /auth/reset-password - Validate token and set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashed, result.rows[0].id]
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});
// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy();
    res.json({ message: 'Logout successful' });
  });
});

// Session check endpoint - helps debug session issues
router.get('/session-check', (req, res) => {
  if (req.user) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false, message: 'Not authenticated' });
  }
});

// Helper function to check if profile is complete
const isProfileComplete = (user) => {
  // Required fields for profile completion
  const requiredFields = ['phone', 'dob', 'gender', 'specialization', 'language_spoken', 'country', 'state', 'city', 'pincode', 'clinic_address'];
  return requiredFields.every(field => {
    const value = user[field];
    if (!value) return false;
    
    // Handle arrays (language_spoken)
    if (Array.isArray(value)) {
      return value.length > 0 && value.some(v => v && v.toString().trim() !== '');
    }
    
    // Handle strings and other types
    return value.toString().trim() !== '';
  });
};

// Get current user (check if logged in)
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const { password, reset_token, reset_token_expires, dob, ...userWithoutSensitive } = req.user;
    const profileComplete = isProfileComplete(req.user);
    res.json({ user: { ...userWithoutSensitive, date_of_birth: dob, profileComplete } });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// GET /auth/dashboard-prefs — fetch dashboard widget preferences
router.get('/dashboard-prefs', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.plan_name !== 'enterprise') {
    return res.status(403).json({ error: 'Dashboard customization is available for Enterprise plan users.' });
  }
  try {
    const result = await pool.query(
      'SELECT enterprise_settings FROM organization_details WHERE user_id = $1',
      [req.user.id]
    );
    const saved = result.rows[0]?.enterprise_settings?.dashboard_widgets;
    // Default: all visible
    const defaults = {
      Revenue: true, Refund: true, Sessions: true, Cancelled: true,
      'No Show': true, 'Pending Notes': true, 'Pending Payment': true, 'No of Clients': true,
    };
    res.json({ widgets: saved ? { ...defaults, ...saved } : defaults });
  } catch (err) {
    console.error('Fetch dashboard prefs error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard preferences' });
  }
});

// PUT /auth/dashboard-prefs — save dashboard widget preferences
router.put('/dashboard-prefs', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.plan_name !== 'enterprise') {
    return res.status(403).json({ error: 'Dashboard customization is available for Enterprise plan users.' });
  }
  try {
    const { widgets } = req.body;
    if (!widgets || typeof widgets !== 'object') {
      return res.status(400).json({ error: 'Invalid widgets payload' });
    }
    await pool.query(
      `INSERT INTO organization_details (user_id, enterprise_settings, updated_at)
       VALUES ($1, jsonb_build_object('dashboard_widgets', $2::jsonb), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enterprise_settings = organization_details.enterprise_settings || jsonb_build_object('dashboard_widgets', $2::jsonb),
         updated_at = NOW()`,
      [req.user.id, JSON.stringify(widgets)]
    );
    res.json({ message: 'Dashboard preferences saved', widgets });
  } catch (err) {
    console.error('Save dashboard prefs error:', err);
    res.status(500).json({ error: 'Failed to save dashboard preferences' });
  }
});
router.get('/enterprise-settings', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.plan_name !== 'enterprise' || req.user.org_role === 'member') {
    return res.status(403).json({ error: 'Only enterprise owners can access these settings' });
  }
  try {
    const result = await pool.query(
      'SELECT enterprise_settings FROM organization_details WHERE user_id = $1',
      [req.user.id]
    );
    const defaults = {
      allow_client_transfers: true,
      require_transfer_approval: false,
    };
    const saved = result.rows[0]?.enterprise_settings || {};
    res.json({ settings: { ...defaults, ...saved } });
  } catch (err) {
    console.error('Fetch enterprise settings error:', err);
    res.status(500).json({ error: 'Failed to fetch enterprise settings' });
  }
});

// PUT /auth/enterprise-settings — save enterprise control center settings
router.put('/enterprise-settings', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.plan_name !== 'enterprise' || req.user.org_role === 'member') {
    return res.status(403).json({ error: 'Only enterprise owners can update these settings' });
  }
  try {
    const allowed = ['allow_client_transfers', 'require_transfer_approval'];
    const settings = {};
    for (const key of allowed) {
      if (typeof req.body[key] === 'boolean') settings[key] = req.body[key];
    }
    await pool.query(
      `INSERT INTO organization_details (user_id, enterprise_settings, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enterprise_settings = organization_details.enterprise_settings || $2::jsonb,
         updated_at = NOW()`,
      [req.user.id, JSON.stringify(settings)]
    );
    res.json({ message: 'Enterprise settings saved', settings });
  } catch (err) {
    console.error('Save enterprise settings error:', err);
    res.status(500).json({ error: 'Failed to save enterprise settings' });
  }
});

// GET /auth/enterprise-analytics — aggregated analytics for all therapists under the owner
router.get('/enterprise-analytics', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.plan_name !== 'enterprise' || req.user.org_role === 'member') {
    return res.status(403).json({ error: 'Only enterprise owners can access analytics' });
  }
  try {
    // Get all therapist IDs under this owner (including the owner themselves)
    const therapistIds = [req.user.id];
    const membersRes = await pool.query(
      'SELECT therapist_user_id FROM organization_therapists WHERE owner_id = $1 AND status = $2 AND therapist_user_id IS NOT NULL',
      [req.user.id, 'active']
    );
    therapistIds.push(...membersRes.rows.map(r => r.therapist_user_id));

    // Aggregate analytics across all therapists
    const analyticsRes = await pool.query(
      `SELECT
        COALESCE(SUM(payment_amount) FILTER (WHERE payment_status IN ('Paid', 'Partial Refund') AND status != 'cancelled'), 0) AS revenue,
        COALESCE(SUM(payment_amount) FILTER (WHERE payment_status IN ('Refunded', 'Partial Refund')), 0) AS refund,
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS sessions,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE status = 'noshow') AS noshow,
        COUNT(*) FILTER (WHERE payment_status = 'Pending' AND status != 'cancelled') AS pending_payment
      FROM Appointments WHERE therapist_id = ANY($1)`,
      [therapistIds]
    );

    const pendingNotesRes = await pool.query(
      `SELECT COUNT(*) FROM Appointments a
       WHERE a.therapist_id = ANY($1) AND a.status = 'scheduled'
       AND a.end_time < NOW()`,
      [therapistIds]
    );

    const clientsRes = await pool.query(
      'SELECT COUNT(*) FROM Clients WHERE therapist_id = ANY($1)',
      [therapistIds]
    );

    const a = analyticsRes.rows[0];
    res.json({
      revenue: parseFloat(a.revenue || 0),
      refund: parseFloat(a.refund || 0),
      sessions: parseInt(a.sessions || 0),
      cancelled: parseInt(a.cancelled || 0),
      noshow: parseInt(a.noshow || 0),
      pending_notes: parseInt(pendingNotesRes.rows[0].count || 0),
      pending_payment: parseInt(a.pending_payment || 0),
      clients: parseInt(clientsRes.rows[0].count || 0),
    });
  } catch (err) {
    console.error('Fetch enterprise analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
router.get('/organization', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.plan_name !== 'enterprise' || req.user.org_role === 'member') {
    return res.status(403).json({ error: 'Only enterprise owners can access organization details' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM organization_details WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ organization: result.rows[0] || null });
  } catch (err) {
    console.error('Fetch org details error:', err);
    res.status(500).json({ error: 'Failed to fetch organization details' });
  }
});

// PUT /auth/organization — upsert org details for the current enterprise owner
router.put('/organization', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.plan_name !== 'enterprise' || req.user.org_role === 'member') {
    return res.status(403).json({ error: 'Only enterprise owners can update organization details' });
  }
  try {
    const { company_name, company_email, gst, street, city, pincode, state, country } = req.body;
    const result = await pool.query(
      `INSERT INTO organization_details (user_id, company_name, company_email, gst, street, city, pincode, state, country, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         company_email = EXCLUDED.company_email,
         gst = EXCLUDED.gst,
         street = EXCLUDED.street,
         city = EXCLUDED.city,
         pincode = EXCLUDED.pincode,
         state = EXCLUDED.state,
         country = EXCLUDED.country,
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, company_name || null, company_email || null, gst || null, street || null, city || null, pincode || null, state || null, country || null]
    );
    res.json({ message: 'Organization details saved', organization: result.rows[0] });
  } catch (err) {
    console.error('Save org details error:', err);
    res.status(500).json({ error: 'Failed to save organization details' });
  }
});

// Upload profile picture
router.post('/upload-profile-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;

    // Upload to Cloudinary using buffer
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'mellominds/profile-pictures',
          public_id: `user_${userId}_${Date.now()}`,
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const fileUrl = uploadResult.secure_url;

    // Update user's profile picture in database
    const result = await pool.query(
      'UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING profile_picture',
      [fileUrl, userId]
    );

    // Delete old profile picture from Cloudinary if it exists
    if (req.user.profile_picture && req.user.profile_picture.includes('cloudinary.com')) {
      try {
        const publicId = req.user.profile_picture.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.error('Error deleting old image:', deleteError);
        // Continue even if deletion fails
      }
    }

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: result.rows[0].profile_picture
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture', details: error.message });
  }
});

export default router;
