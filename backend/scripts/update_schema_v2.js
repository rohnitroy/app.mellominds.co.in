
import pool from '../config/database.js';

const updateSchemaV2 = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting schema update v2...');

        // Add payment columns to Appointments
        console.log('Checking Appointments table for payment columns...');
        await client.query(`
            ALTER TABLE Appointments 
            ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending',
            ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2) DEFAULT 0.00;
        `);
        console.log('✅ Added payment_status and payment_amount to Appointments table');

        console.log('🎉 Schema v2 update completed successfully!');
    } catch (err) {
        console.error('❌ Error updating schema v2:', err);
    } finally {
        client.release();
        pool.end();
    }
};

updateSchemaV2();
