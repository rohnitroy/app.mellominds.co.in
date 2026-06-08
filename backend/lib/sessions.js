import pool from '../config/database.js';

export const initializeSessionsTable = async () => {
  try {
    await pool.query(`DROP TABLE IF EXISTS user_sessions`);

    await pool.query(`
      CREATE TABLE user_sessions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        login_time TIMESTAMP DEFAULT NOW(),
        logout_time TIMESTAMP,
        duration_minutes INTEGER
      )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
    console.log('✅ User sessions schema verified');
  } catch (err) {
    console.error('❌ Sessions table error:', err.message);
    throw err;
  }
};
