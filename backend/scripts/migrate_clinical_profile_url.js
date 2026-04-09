import pool from '../config/database.js';

const migrate = async () => {
    try {
        await pool.query(`
            ALTER TABLE Clients
            ADD COLUMN IF NOT EXISTS clinical_profile_url TEXT;
        `);
        console.log('✅ clinical_profile_url column added to Clients table');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
};

migrate();
