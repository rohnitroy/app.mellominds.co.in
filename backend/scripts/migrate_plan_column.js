import pool from '../config/database.js';

async function migratePlanColumn() {
  try {
    // Add plan_name column with default 'free' — all existing users become Free (Early Access)
    await pool.query(`
      ALTER TABLE Users
      ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50) NOT NULL DEFAULT 'free'
        CHECK (plan_name IN ('free', 'individual', 'team', 'enterprise'));
    `);
    console.log('✅ plan_name column added to Users table (default: free)');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migratePlanColumn();
