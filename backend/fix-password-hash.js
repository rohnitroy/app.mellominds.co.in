#!/usr/bin/env node

import './config/env.js';
import pool from './config/database.js';

console.log('\n=== Fixing password_hash Column ===\n');

try {
  console.log('1. Making password_hash column nullable...');
  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL
  `);
  console.log('   ✓ password_hash column is now nullable');

  console.log('\n2. Verifying the change...');
  const result = await pool.query(`
    SELECT column_name, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'password_hash'
  `);
  
  if (result.rows[0].is_nullable === 'YES') {
    console.log('   ✓ password_hash is now nullable');
  } else {
    console.log('   ✗ password_hash is still NOT NULL');
  }

  console.log('\n✅ Fix applied successfully!\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
}
