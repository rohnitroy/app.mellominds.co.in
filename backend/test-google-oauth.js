#!/usr/bin/env node

import './config/env.js';
import pool from './config/database.js';

console.log('\n=== Google OAuth Configuration Test ===\n');

// Check environment variables
console.log('1. Checking environment variables:');
console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
console.log('   GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL ? '✓ Set' : '✗ Missing');
console.log('   FRONTEND_URL:', process.env.FRONTEND_URL ? '✓ Set' : '✗ Missing');
console.log('   SESSION_SECRET:', process.env.SESSION_SECRET ? '✓ Set' : '✗ Missing');

// Check database connection
console.log('\n2. Checking database connection:');
try {
  const result = await pool.query('SELECT NOW()');
  console.log('   ✓ Database connected');
  console.log('   Current time:', result.rows[0].now);
} catch (err) {
  console.error('   ✗ Database connection failed:', err.message);
  process.exit(1);
}

// Check if users table exists
console.log('\n3. Checking users table:');
try {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'users'
    )
  `);
  if (result.rows[0].exists) {
    console.log('   ✓ Users table exists');
    
    // Check columns
    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('   Columns:', columns.rows.map(r => r.column_name).join(', '));
  } else {
    console.log('   ✗ Users table does not exist');
  }
} catch (err) {
  console.error('   ✗ Error checking users table:', err.message);
}

// Check if google_id column exists
console.log('\n4. Checking google_id column:');
try {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'google_id'
    )
  `);
  if (result.rows[0].exists) {
    console.log('   ✓ google_id column exists');
  } else {
    console.log('   ✗ google_id column does not exist');
  }
} catch (err) {
  console.error('   ✗ Error checking google_id column:', err.message);
}

// Check if password column allows NULL
console.log('\n5. Checking password column:');
try {
  const result = await pool.query(`
    SELECT is_nullable FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password'
  `);
  if (result.rows.length > 0) {
    const isNullable = result.rows[0].is_nullable === 'YES';
    if (isNullable) {
      console.log('   ✓ password column allows NULL');
    } else {
      console.log('   ✗ password column does NOT allow NULL (OAuth users will fail)');
    }
  } else {
    console.log('   ✗ password column does not exist');
  }
} catch (err) {
  console.error('   ✗ Error checking password column:', err.message);
}

console.log('\n=== Test Complete ===\n');
process.exit(0);
