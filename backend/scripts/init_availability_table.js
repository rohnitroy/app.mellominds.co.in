// backend/scripts/init_availability_table.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Dynamic import to ensure process.env is set before database.js runs
const { default: pool } = await import('../config/database.js');

const createTable = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Creating Availability table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS Availability (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES Users(id),
                day_of_week INT NOT NULL, -- 0 for Sunday, 1 for Monday...
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                is_enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, day_of_week, start_time, end_time)
            );
        `);

        // Index for faster lookups
        await client.query(`CREATE INDEX IF NOT EXISTS idx_availability_user ON Availability(user_id);`);

        await client.query('COMMIT');
        console.log('Availability table created successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating table:', error);
    } finally {
        client.release();
        process.exit();
    }
};

createTable();
