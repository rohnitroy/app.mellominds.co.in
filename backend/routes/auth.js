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
import { checkLoginAttempts, recordFailedLogin, resetFailedLogins, enforceConcurrentSessionLimit, invalidateUserSessions } from '../middleware/sessionSecurity.js';
import { isDisposable } from '../lib/disposableEmail.js';

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
    // Block disposable/temporary email providers
    if (await isDisposable(email)) {
      return res.status(400).json({ error: 'Disposable or temporary email addresses are not allowed. Please use a real email.' });
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
    const existingUser = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Capitalize gender to match DB constraint
    const formattedGender = gender ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase() : null;

    // Insert user into database
    const result = await pool.query(
      `INSERT INTO Users (user_name, email, password, phone, dob, gender, specialization, language_spoken, country, state, city, pincode, clinic_address, auth_provider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id, user_name, email`,
      [fullName, email, hashedPassword, phoneNumber || null, dateOfBirth || null, formattedGender, specialization || null, languages || null, country || null, state || null, city || null, pincode || null, address || null, 'email']
    );

    // Fire-and-forget: notify team of new user signup
    const alertEmail = newUserAlertEmail({ userName: fullName, email, authProvider: 'email' });
    sendEmail({ to: 'sarafaastha13@gmail.com', cc: 'adosolve@gmail.com', ...alertEmail })
      .catch(err => console.error('New user alert email failed:', err.message));

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
            `UPDATE Users SET plan_name = 'enterprise', org_role = 'member', org_owner_id = $1 WHERE id = $2`,
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

    // Check account lockout
    const lockStatus = await checkLoginAttempts(email);
    if (lockStatus.locked) {
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed attempts. Please try again later.',
        lockoutEndsAt: lockStatus.lockoutEndsAt,
      });
    }

    // Find user by email
    const result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      await recordFailedLogin(email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user registered with Google (no password)
    if (!user.password) {
      return res.status(401).json({ error: 'Please login with Google' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await recordFailedLogin(email);
      const remaining = lockStatus.remainingAttempts - 1;
      return res.status(401).json({
        error: 'Invalid email or password',
        ...(remaining <= 2 && { warning: `${remaining} attempt(s) remaining before account lockout.` }),
      });
    }

    // Successful login — reset failed attempts
    await resetFailedLogins(email);

    // Update last login metadata
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await pool.query(
      'UPDATE Users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [clientIp, user.id]
    ).catch(() => {}); // non-fatal

    // Login user (create session)
    req.login(user, async (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }

      // Enforce concurrent session limit
      await enforceConcurrentSessionLimit(user.id);

      // Remove password from response
      const { password: _pw, reset_token, reset_token_expires, failed_login_attempts, locked_until, ...safeUser } = user;
      res.json({ message: 'Login successful', user: safeUser });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initiate Google OAuth login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

// Google OAuth callback
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google Auth Error:', err);
      // Check for specific error types if needed
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed_server&details=${encodeURIComponent(err.message)}`);
    }
    if (!user) {
      console.error('Google Auth Failed: No user returned', info);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed_nouser`);
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error('Session Save Error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_error`);
      }

      // Check if user has completed profile
      if (!user.phone) {
        return res.redirect(`${process.env.FRONTEND_URL}/complete-profile`);
      }
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

    // Update user in database
    const result = await pool.query(
      `UPDATE Users 
       SET phone = $1, dob = $2, gender = $3, specialization = $4, language_spoken = $5, 
           country = $6, state = $7, city = $8, pincode = $9, clinic_address = $10 
       WHERE id = $11 
       RETURNING *`,
      [phoneNumber, dateOfBirth, formattedGender, specialization, languages, country, state, city, pincode, address, userId]
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

    const result = await pool.query('SELECT id, auth_provider FROM Users WHERE email = $1', [email]);

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
      'UPDATE Users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
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
      'SELECT id FROM Users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const userId = result.rows[0].id;
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE Users SET password = $1, reset_token = NULL, reset_token_expires = NULL, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
      [hashed, userId]
    );

    // Invalidate all existing sessions for this user (security: force re-login)
    await invalidateUserSessions(userId);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});
// Logout
router.post('/logout', (req, res) => {
  const sessionId = req.sessionID;
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Session destroy error:', destroyErr);
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logout successful' });
    });
  });
});

// Get current user (check if logged in) — includes RBAC context
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const { password, reset_token, reset_token_expires, failed_login_attempts, locked_until, ...userWithoutSensitive } = req.user;
    res.json({
      user: userWithoutSensitive,
      rbac: req.rbac ? {
        role: req.rbac.role,
        permissions: req.rbac.permissions,
      } : undefined,
    });
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

// POST /auth/logout-all — Invalidate all sessions except current
router.post('/logout-all', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const count = await invalidateUserSessions(req.user.id, req.sessionID);
    res.json({ message: `Logged out of ${count} other session(s).` });
  } catch (err) {
    console.error('Logout all error:', err);
    res.status(500).json({ error: 'Failed to invalidate sessions' });
  }
});

// GET /auth/sessions — List active sessions for current user
router.get('/sessions', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const result = await pool.query(
      `SELECT sid, expire, 
              sess::jsonb->'_security'->>'lastActivity' as last_activity,
              sess::jsonb->'_security'->>'createdAt' as created_at
       FROM user_sessions 
       WHERE sess::jsonb->'passport'->>'user' = $1
       AND expire > NOW()
       ORDER BY expire DESC`,
      [String(req.user.id)]
    );

    const sessions = result.rows.map(row => ({
      id: row.sid.slice(0, 8) + '...', // Partial ID for display
      isCurrent: row.sid === req.sessionID,
      lastActivity: row.last_activity ? new Date(parseInt(row.last_activity)).toISOString() : null,
      createdAt: row.created_at ? new Date(parseInt(row.created_at)).toISOString() : null,
      expiresAt: row.expire,
    }));

    res.json({ sessions, total: sessions.length });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
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
      'UPDATE Users SET profile_picture = $1 WHERE id = $2 RETURNING profile_picture',
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
