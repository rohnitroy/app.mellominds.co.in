#!/usr/bin/env node

import './config/env.js';
import express from 'express';
import passport from './config/passport.js';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool from './config/database.js';

const app = express();
const PORT = 3001;

// Session configuration
const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: 'lax',
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Test routes
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running' });
});

app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback', (req, res, next) => {
  console.log('[DEBUG] Google callback received');
  console.log('[DEBUG] Query params:', req.query);
  
  passport.authenticate('google', (err, user, info) => {
    console.log('[DEBUG] Passport authenticate callback called');
    console.log('[DEBUG] Error:', err);
    console.log('[DEBUG] User:', user ? `id=${user.id}` : 'null');
    
    if (err) {
      console.error('[DEBUG] Google Auth Error:', err);
      return res.json({ error: err.message });
    }
    if (!user) {
      console.error('[DEBUG] Google Auth Failed: No user returned', info);
      return res.json({ error: 'No user returned' });
    }
    
    req.logIn(user, (err) => {
      if (err) {
        console.error('[DEBUG] Session Save Error:', err);
        return res.json({ error: err.message });
      }
      
      console.log('[DEBUG] Session saved successfully');
      res.json({ message: 'Logged in successfully', user: user.id });
    });
  })(req, res, next);
});

app.listen(PORT, () => {
  console.log(`\n✅ Test server running on port ${PORT}`);
  console.log(`\nTest URLs:`);
  console.log(`  - http://localhost:${PORT}/test`);
  console.log(`  - http://localhost:${PORT}/auth/google`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
