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
    // Check calendars
    const calendars = await pool.query('SELECT id, user_id, title, duration FROM Calendars ORDER BY id');
    console.log('\n📅 CALENDARS:');
    console.log(JSON.stringify(calendars.rows, null, 2));
    
    // Check availability for each user
    const users = [...new Set(calendars.rows.map(c => c.user_id))];
    
    for (const userId of users) {
      console.log(`\n⏰ AVAILABILITY FOR USER ${userId}:`);
      const avail = await pool.query(
        'SELECT day_of_week, start_time, end_time, is_enabled FROM Availability WHERE user_id = $1 ORDER BY day_of_week',
        [userId]
      );
      console.log(JSON.stringify(avail.rows, null, 2));
    }
    
    // Test slot generation for Monday (day 1)
    const testDate = '2026-03-09'; // Monday
    const testCalendarId = calendars.rows[0]?.id;
    
    if (testCalendarId) {
      console.log(`\n🧪 TESTING SLOTS FOR:`);
      console.log(`   Date: ${testDate} (Monday)`);
      console.log(`   Calendar ID: ${testCalendarId}`);
      
      const cal = await pool.query('SELECT user_id, duration FROM Calendars WHERE id = $1', [testCalendarId]);
      const userId = cal.rows[0].user_id;
      
      const avail = await pool.query(
        'SELECT start_time, end_time FROM Availability WHERE user_id = $1 AND day_of_week = 1 AND is_enabled = true',
        [userId]
      );
      
      console.log(`   User ID: ${userId}`);
      console.log(`   Availability windows:`, avail.rows);
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
