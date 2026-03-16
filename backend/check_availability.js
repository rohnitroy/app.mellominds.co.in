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
    const result = await pool.query('SELECT * FROM Availability ORDER BY user_id, day_of_week');
    console.log('Availability Records:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('Sample:', JSON.stringify(result.rows.slice(0, 5), null, 2));
    } else {
      console.log('❌ No availability configured yet!');
      console.log('You need to set your Available Hours in the My Calendars page.');
    }
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
