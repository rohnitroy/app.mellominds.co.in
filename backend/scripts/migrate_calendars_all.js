import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Running full Calendars table migration...');
        await pool.query(`
            ALTER TABLE Calendars
            ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS cancellation_policy JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS reschedule_policy JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS schedule_settings JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS max_attendees INT DEFAULT NULL
        `);
    
        console.log('✅ All Calendars columns ensured.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
