import pool from '../config/database.js';

async function migratePlansOrganization() {
  try {
    await pool.query(`
      ALTER TABLE Plans
      ADD COLUMN IF NOT EXISTS organization VARCHAR(255);
    `);
    console.log('✅ organization column added to Plans table (nullable — enterprise only)');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migratePlansOrganization();
