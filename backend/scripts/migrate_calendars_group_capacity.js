import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Adding max_attendees column to Calendars table...');
        await pool.query(`
            ALTER TABLE Calendars
            ADD COLUMN IF NOT EXISTS max_attendees INT DEFAULT NULL
        `);
        console.log('✅ max_attendees column added (or already exists).');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
