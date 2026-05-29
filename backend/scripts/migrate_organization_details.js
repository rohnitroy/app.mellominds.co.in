import pool from '../config/database.js';

const migrate = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organization_details (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE REFERENCES Users(id) ON DELETE CASCADE,
        company_name VARCHAR(255),
        company_email VARCHAR(150),
        gst VARCHAR(50),
        street TEXT,
        city VARCHAR(100),
        pincode VARCHAR(20),
        state VARCHAR(100),
        country VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ organization_details table created (or already exists)');
  } catch (err) {
    console.error('❌ Migration failed:', err.message, err);
  } finally {
    await pool.end();
  }
};

migrate();
