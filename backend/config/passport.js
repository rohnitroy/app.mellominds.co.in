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

        // Check if user already exists with this Google ID
        let result = await pool.query(
          'SELECT * FROM Users WHERE google_id = $1',
          [googleId]
        );

        let user;

        if (result.rows.length > 0) {
          // User exists, return existing user
          user = result.rows[0];
        } else {
          // Check if email already exists (user might have registered with email/password)
          result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

          if (result.rows.length > 0) {
            // Email exists, link Google account to existing user
            result = await pool.query(
              'UPDATE Users SET google_id = $1, auth_provider = $2, profile_picture = $3 WHERE email = $4 RETURNING *',
              [googleId, 'google', profilePicture, email]
            );
            user = result.rows[0];
          } else {
            // Create new user with Google OAuth
            result = await pool.query(
              'INSERT INTO Users (user_name, email, google_id, auth_provider, profile_picture) VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [userName, email, googleId, 'google', profilePicture]
            );
            user = result.rows[0];

            // Fire-and-forget: notify team of new Google signup
            const alertEmail = newUserAlertEmail({ userName, email, authProvider: 'google' });
            sendEmail({ to: 'sarafaastha13@gmail.com', cc: 'adosolve@gmail.com', ...alertEmail })
              .catch(err => console.error('New user alert email failed:', err.message));
          }
        }

        return done(null, user);
      } catch (error) {
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
    const result = await pool.query('SELECT * FROM Users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
