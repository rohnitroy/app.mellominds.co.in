
import pool from '../config/database.js';

const updateSchema = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting schema update...');

    // 1. Add client_phone to Appointments if it doesn't exist
    console.log('Checking Appointments table...');
    await client.query(`
      ALTER TABLE Appointments 
      ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20);
    `);
    console.log('✅ Checked/Updated Appointments table');

    // 2. Create Notes table
    console.log('Checking Notes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS Notes (
        id SERIAL PRIMARY KEY,
        therapist_id INT NOT NULL REFERENCES Users(id),
        client_email VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Checked/Created Notes table');

    // 3. Update Users table for Google Auth
    console.log('Checking Users table for Google Auth columns...');
    await client.query(`
            ALTER TABLE Users 
            ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
            ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(2083);
        `);
    console.log('✅ Checked/Updated Users table');

    console.log('🎉 Schema update completed successfully!');
  } catch (err) {
    console.error('❌ Error updating schema:', err);
  } finally {
    client.release();
    pool.end();
  }
};

updateSchema();
