import express from 'express';
import passport from '../config/passport.js';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profile-pictures');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required' });
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
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
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
    const { password, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
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
    const fileUrl = `/uploads/profile-pictures/${req.file.filename}`;

    // Update user's profile picture in database
    const result = await pool.query(
      'UPDATE Users SET profile_picture = $1 WHERE id = $2 RETURNING profile_picture',
      [fileUrl, userId]
    );

    // Delete old profile picture if it exists and is not a Google URL
    if (req.user.profile_picture && !req.user.profile_picture.includes('googleusercontent.com')) {
      const oldFilePath = path.join(__dirname, '..', req.user.profile_picture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: result.rows[0].profile_picture
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    // Delete uploaded file if database update fails
    if (req.file) {
      const filePath = path.join(__dirname, '../uploads/profile-pictures', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(500).json({ error: 'Failed to upload profile picture', details: error.message });
  }
});

export default router;
