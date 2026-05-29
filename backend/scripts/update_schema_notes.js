
import pool from '../config/database.js';

const updateSchemaNotes = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting schema update for Session Notes...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS SessionNotes (
                id SERIAL PRIMARY KEY,
                appointment_id INTEGER REFERENCES Appointments(id) ON DELETE CASCADE,
                therapist_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
                note_content JSONB DEFAULT '[]'::jsonb, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Created SessionNotes table');

    } catch (err) {
        console.error('❌ Error updating schema for notes:', err);
    } finally {
        client.release();
        pool.end();
    }
};

updateSchemaNotes();
