#!/usr/bin/env node

import './config/env.js';
import pool from './config/database.js';

const result = await pool.query(`
  SELECT column_name, data_type, is_nullable 
  FROM information_schema.columns 
  WHERE table_name = 'users' 
  AND column_name IN ('password', 'password_hash')
  ORDER BY ordinal_position
`);

console.log('Password columns:');
result.rows.forEach(r => {
  console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
});

process.exit(0);
