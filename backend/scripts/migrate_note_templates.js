import '../config/env.js';
import pool from '../config/database.js';

async function migrate() {
    try {
        console.log('Creating NoteTemplates table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS NoteTemplates (
                id SERIAL PRIMARY KEY,
                therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
                fields JSONB NOT NULL DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(therapist_id)
            )
        `);

        console.log('Adding updated_at to SessionNotes if missing...');
        await pool.query(`
            ALTER TABLE SessionNotes
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        console.log('✅ NoteTemplates migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
