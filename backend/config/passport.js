import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import pool from './database.js';
import { sendEmail, newUserAlertEmail } from '../lib/email.js';

import './env.js';

// Verify Google OAuth credentials are loaded
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌ CRITICAL: Google OAuth credentials not found in environment variables');
  console.error('  GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.error('  GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.error('  GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL ? '✓ Set' : '✗ Missing');
} else {
  console.log('✅ Google OAuth credentials loaded successfully');
}

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('[DEBUG] Google OAuth Strategy called');
        console.log('[DEBUG] Profile ID:', profile.id);
        console.log('[DEBUG] Profile emails:', profile.emails?.length);
        
        // Extract user info from Google profile
        const googleId = profile.id;
        const email = profile.emails[0]?.value;
        const userName = profile.displayName;
        const profilePicture = profile.photos[0]?.value || null;

        if (!email) {
          console.error('[DEBUG] Google OAuth: No email found in profile');
          return done(new Error('No email found in Google profile'), null);
        }

        console.log(`[DEBUG] Google OAuth: email=${email}, userName=${userName}, picture=${profilePicture ? 'yes' : 'no'}`);

        // Check if user already exists with this Google ID
        let result = await pool.query(
          'SELECT * FROM users WHERE google_id = $1',
          [googleId]
        );

        let user;

        if (result.rows.length > 0) {
          // User exists, update their name and picture from Google
          console.log(`[DEBUG] Google user exists: id=${result.rows[0].id}, current_name=${result.rows[0].user_name}`);
          result = await pool.query(
            'UPDATE users SET user_name = $1, profile_picture = $2 WHERE google_id = $3 RETURNING *',
            [userName, profilePicture, googleId]
          );
          user = result.rows[0];
          console.log(`[DEBUG] Updated existing Google user: id=${user.id}, new_name=${user.user_name}`);
        } else {
          // Check if email already exists (user might have registered with email/password)
          result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

          if (result.rows.length > 0) {
            // Email exists, link Google account to existing user
            console.log(`[DEBUG] Linking Google to existing email user`);
            result = await pool.query(
              'UPDATE users SET google_id = $1, auth_provider = $2, profile_picture = $3, user_name = $4 WHERE email = $5 RETURNING *',
              [googleId, 'google', profilePicture, userName, email]
            );
            user = result.rows[0];
            console.log(`[DEBUG] Updated user: id=${user.id}, new_name=${user.user_name}`);
          } else {
            // Create new user with Google OAuth
            console.log(`[DEBUG] Creating new Google user`);
            result = await pool.query(
              'INSERT INTO users (user_name, email, google_id, auth_provider, profile_picture, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
              [userName, email, googleId, 'google', profilePicture, null]
            );
            user = result.rows[0];
            console.log(`[DEBUG] Created user: id=${user.id}, name=${user.user_name}`);

            // Fire-and-forget: notify team of new Google signup
            const alertEmail = newUserAlertEmail({ userName, email, authProvider: 'google' });
            sendEmail({ to: 'sarafaastha13@gmail.com', cc: 'adosolve@gmail.com', ...alertEmail })
              .catch(err => console.error('New user alert email failed:', err.message));
          }
        }

        // Reactivate deleted accounts
        if (user.account_status === 'deleted') {
          console.log(`[DEBUG] Google OAuth: Reactivating deleted user ${user.id}`);
          result = await pool.query(
            'UPDATE users SET account_status = $1, auth_provider = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            ['active', 'google', user.id]
          );
          user = result.rows[0];
          console.log(`[DEBUG] User ${user.id} reactivated via Google OAuth`);
        }

        console.log('[DEBUG] Google OAuth Strategy: returning user', user.id);
        return done(null, user);
      } catch (error) {
        console.error('[DEBUG] Google OAuth error:', error);
        console.error('[DEBUG] Error stack:', error.stack);
        return done(error, null);
      }
    }
  )
);

// Serialize user to session (store user ID in session)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session (retrieve user from database)
passport.deserializeUser(async (id, done) => {
  try {
    if (!id) {
      console.warn('[DEBUG] Deserialize: No user ID provided');
      return done(null, false);
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      console.warn(`[DEBUG] Deserialize: User ID ${id} not found in database`);
      return done(null, false);
    }

    if (result.rows[0].account_status === 'deleted') {
      console.warn(`[DEBUG] Deserialize: User ID ${id} account is deleted`);
      return done(null, false);
    }

    done(null, result.rows[0]);
  } catch (error) {
    console.error('[DEBUG] Deserialize error:', error.message);
    done(error, null);
  }
});

export default passport;
