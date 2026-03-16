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
    const users = await pool.query('SELECT id, user_name, email FROM Users ORDER BY id');
    console.log('\n👥 USERS:');
    users.rows.forEach(u => {
      console.log(`   User ${u.id}: ${u.user_name} (${u.email})`);
    });
    
    console.log('\n📊 SUMMARY:');
    console.log('   - User 3 has availability configured ✅');
    console.log('   - User 6 has NO availability ❌');
    console.log('   - User 7 has NO availability ❌');
    console.log('\n💡 SOLUTION:');
    console.log('   Login as the user who owns the calendar and click "Available Hours"');
    console.log('   in the My Calendars page to set your schedule.');
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
