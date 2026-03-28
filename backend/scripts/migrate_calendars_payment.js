import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Adding payment columns to Calendars table...');
        await pool.query(`
            ALTER TABLE Calendars
            ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS cancellation_policy JSONB DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS reschedule_policy JSONB DEFAULT NULL
        `);
        console.log('✅ Payment columns added (or already exist).');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
