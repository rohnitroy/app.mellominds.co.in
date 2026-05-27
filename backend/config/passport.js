import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import pool from './database.js';
import { sendEmail, newUserAlertEmail } from '../lib/email.js';

import './env.js';

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Extract user info from Google profile
        const googleId = profile.id;
        const email = profile.emails[0].value;
        const userName = profile.displayName;
        const profilePicture = profile.photos[0]?.value || null;

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
              'INSERT INTO users (user_name, email, google_id, auth_provider, profile_picture) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [userName, email, googleId, 'google', profilePicture]
            );
            user = result.rows[0];
            console.log(`[DEBUG] Created user: id=${user.id}, name=${user.user_name}`);

            // Fire-and-forget: notify team of new Google signup
            const alertEmail = newUserAlertEmail({ userName, email, authProvider: 'google' });
            sendEmail({ to: 'sarafaastha13@gmail.com', cc: 'adosolve@gmail.com', ...alertEmail })
              .catch(err => console.error('New user alert email failed:', err.message));
          }
        }

        return done(null, user);
      } catch (error) {
        console.error('[DEBUG] Google OAuth error:', error);
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
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
