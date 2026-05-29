import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Adding Cashfree columns to UserIntegrations...');
        await pool.query(`
            ALTER TABLE UserIntegrations
            ADD COLUMN IF NOT EXISTS app_id VARCHAR(255) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS secret_key VARCHAR(512) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'sandbox'
        `);
        console.log('✅ Cashfree columns added (or already exist).');

        console.log('Adding cashfree_order_id to Appointments...');
        await pool.query(`
            ALTER TABLE Appointments
            ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(255) DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS cashfree_payment_link TEXT DEFAULT NULL
        `);
        console.log('✅ Appointment payment columns added.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
