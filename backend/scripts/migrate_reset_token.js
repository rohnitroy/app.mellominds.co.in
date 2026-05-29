import pool from '../config/database.js';

const run = async () => {
  await pool.query(`
    ALTER TABLE Users
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
  `);
  console.log('✅ reset_token columns added to Users table');
  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
