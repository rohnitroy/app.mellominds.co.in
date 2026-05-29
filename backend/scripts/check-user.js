import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '187.127.140.201',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mello_db',
  user: process.env.DB_USER || 'mello_admin',
  password: process.env.DB_PASSWORD || 'Mello@dbadmin',
});

async function check() {
  try {
    const result = await pool.query(
      `SELECT id, email, password, password_hash FROM Users WHERE email = 'demo@mellominds.co.in'`
    );
    
    if (result.rows.length === 0) {
      console.log('User not found');
    } else {
      const user = result.rows[0];
      console.log('User found:');
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  password column:', user.password ? 'HAS VALUE' : 'NULL');
      console.log('  password_hash column:', user.password_hash ? 'HAS VALUE' : 'NULL');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
