import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Adding form_data column to Calendars table...');
        await client.query(`
            ALTER TABLE Calendars 
            ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT NULL
        `);
        console.log('✅ form_data column added (or already exists).');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
