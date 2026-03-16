import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

(async () => {
  try {
    // Check Users table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 USERS TABLE COLUMNS:');
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    // Check if profile_picture column exists and sample data
    const users = await pool.query('SELECT id, user_name, email, profile_picture FROM Users LIMIT 5');
    
    console.log('\n👤 SAMPLE USER DATA:');
    users.rows.forEach(u => {
      console.log(`   User ${u.id}: ${u.user_name}`);
      console.log(`      Email: ${u.email}`);
      console.log(`      Profile Picture: ${u.profile_picture || 'NULL (not set)'}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
