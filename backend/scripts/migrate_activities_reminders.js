import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        await pool.query(`
            ALTER TABLE ClientActivities
            ADD COLUMN IF NOT EXISTS notify_client BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS reminder_count INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS reminder_interval_days INT DEFAULT 1,
            ADD COLUMN IF NOT EXISTS reminders_sent INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMPTZ DEFAULT NULL
        `);
        console.log('✅ ClientActivities reminder columns added');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
