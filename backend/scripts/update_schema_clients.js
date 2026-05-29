
import pool from '../config/database.js';

const updateSchemaClients = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting schema update for Clients...');

        // Create Clients Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS Clients (
                id SERIAL PRIMARY KEY,
                therapist_id INTEGER REFERENCES Users(id),
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                emergency_name VARCHAR(255),
                emergency_phone VARCHAR(50),
                emergency_relation VARCHAR(100),
                age VARCHAR(10),
                occupation VARCHAR(100),
                gender VARCHAR(20),
                marital_status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(therapist_id, email)
            );
        `);
        console.log('✅ Created Clients table');

        // Create ClientActivities Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ClientActivities (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES Clients(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_visible BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created ClientActivities table');

        console.log('🎉 Clients schema update completed successfully!');
    } catch (err) {
        console.error('❌ Error updating clients schema:', err);
    } finally {
        client.release();
        pool.end();
    }
};

updateSchemaClients();
