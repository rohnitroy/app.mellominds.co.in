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

    // Find user by email
    const result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
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

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE Users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
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

// Get current user (check if logged in)
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const { password, reset_token, reset_token_expires, ...userWithoutSensitive } = req.user;
    res.json({ user: userWithoutSensitive });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
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
