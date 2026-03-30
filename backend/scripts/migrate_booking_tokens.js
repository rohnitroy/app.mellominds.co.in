import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Adding cancel_token to Appointments...');
        await pool.query(`
            ALTER TABLE Appointments
            ADD COLUMN IF NOT EXISTS cancel_token VARCHAR(64) UNIQUE DEFAULT NULL
        `);

        // Enable pgcrypto if available, otherwise use md5+random fallback
        try {
            await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
            await pool.query(`
                UPDATE Appointments
                SET cancel_token = encode(gen_random_bytes(32), 'hex')
                WHERE cancel_token IS NULL
            `);
        } catch {
            // Fallback: use md5 of id + random
            await pool.query(`
                UPDATE Appointments
                SET cancel_token = md5(id::text || random()::text || now()::text)
                WHERE cancel_token IS NULL
            `);
        }

        console.log('✅ cancel_token column added and backfilled.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
