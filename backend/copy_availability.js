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
    console.log('📋 Copying availability from User 3 to User 7...\n');
    
    // Get User 3's availability
    const sourceAvail = await pool.query(
      'SELECT day_of_week, start_time, end_time, is_enabled FROM Availability WHERE user_id = 3'
    );
    
    console.log(`Found ${sourceAvail.rows.length} availability records for User 3`);
    
    // Delete existing availability for User 7 (if any)
    await pool.query('DELETE FROM Availability WHERE user_id = 7');
    console.log('Cleared existing availability for User 7');
    
    // Copy to User 7
    for (const slot of sourceAvail.rows) {
      await pool.query(
        `INSERT INTO Availability (user_id, day_of_week, start_time, end_time, is_enabled) 
         VALUES ($1, $2, $3, $4, $5)`,
        [7, slot.day_of_week, slot.start_time, slot.end_time, slot.is_enabled]
      );
    }
    
    console.log(`✅ Successfully copied ${sourceAvail.rows.length} availability slots to User 7\n`);
    
    // Verify
    const newAvail = await pool.query(
      'SELECT day_of_week, start_time, end_time, is_enabled FROM Availability WHERE user_id = 7 ORDER BY day_of_week'
    );
    
    console.log('📅 User 7 Availability:');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    newAvail.rows.forEach(slot => {
      const status = slot.is_enabled ? '✅' : '❌';
      console.log(`   ${status} ${days[slot.day_of_week]}: ${slot.start_time.slice(0,5)} - ${slot.end_time.slice(0,5)}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
