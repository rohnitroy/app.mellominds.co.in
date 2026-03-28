import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Adding locations and schedule_settings columns to Calendars table...');
        await pool.query(`
            ALTER TABLE Calendars
            ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS schedule_settings JSONB DEFAULT NULL
        `);
        console.log('✅ locations and schedule_settings columns added (or already exist).');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
