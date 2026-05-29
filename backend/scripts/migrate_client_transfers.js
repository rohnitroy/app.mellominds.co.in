import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Creating ClientTransfers table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ClientTransfers (
                id SERIAL PRIMARY KEY,
                client_id INT NOT NULL REFERENCES Clients(id) ON DELETE CASCADE,
                from_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                to_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                transfer_options JSONB DEFAULT '{}',
                notification_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ ClientTransfers table created.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
