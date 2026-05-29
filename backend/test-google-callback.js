#!/usr/bin/env node

import './config/env.js';
import pool from './config/database.js';

console.log('\n=== Testing Google OAuth Callback Simulation ===\n');

try {
  // Simulate creating a new user from Google OAuth
  const googleId = 'test-google-id-' + Date.now();
  const email = 'test-' + Date.now() + '@gmail.com';
  const userName = 'Test User';
  const profilePicture = 'https://example.com/pic.jpg';

  console.log('1. Attempting to create new Google user:');
  console.log('   googleId:', googleId);
  console.log('   email:', email);
  console.log('   userName:', userName);

  const result = await pool.query(
    'INSERT INTO users (user_name, email, google_id, auth_provider, profile_picture, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [userName, email, googleId, 'google', profilePicture, null]
  );

  console.log('\n2. User created successfully:');
  console.log('   id:', result.rows[0].id);
  console.log('   email:', result.rows[0].email);
  console.log('   google_id:', result.rows[0].google_id);
  console.log('   auth_provider:', result.rows[0].auth_provider);
  console.log('   password:', result.rows[0].password);

  console.log('\n3. Verifying user can be retrieved:');
  const verify = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  console.log('   Found:', verify.rows.length > 0 ? 'Yes' : 'No');

  console.log('\n✅ Google OAuth callback simulation successful!\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}
