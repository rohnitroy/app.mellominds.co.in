import pool from '../config/database.js';

const initClientsTable = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting Clients table initialization...');

        await client.query('BEGIN');

        // 1. Create Clients table
        console.log('Creating Clients table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS Clients (
                id SERIAL PRIMARY KEY,
                therapist_id INT NOT NULL REFERENCES Users(id),
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                age VARCHAR(10),
                occupation VARCHAR(255),
                gender VARCHAR(50),
                marital_status VARCHAR(50),
                emergency_name VARCHAR(255),
                emergency_phone VARCHAR(50),
                emergency_relation VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(therapist_id, email)
            );
        `);

        // 2. Backfill from Appointments
        console.log('Backfilling Clients from Appointments...');
        // We select distinct clients per therapist. 
        // We take the latest phone number available.
        const backfillQuery = `
            INSERT INTO Clients (therapist_id, name, email, phone)
            SELECT DISTINCT ON (therapist_id, client_email)
                therapist_id,
                client_name,
                client_email,
                client_phone
            FROM Appointments
            WHERE client_email IS NOT NULL
            ORDER BY therapist_id, client_email, start_time DESC
            ON CONFLICT (therapist_id, email) DO NOTHING;
        `;

        await client.query(backfillQuery);

        await client.query('COMMIT');
        console.log('✅ Clients table created and populated successfully!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error initializing Clients table:', err);
    } finally {
        client.release();
        // Close pool to allow script to exit
        pool.end();
    }
};

initClientsTable();
