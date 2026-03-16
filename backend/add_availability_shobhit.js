import dotenv from 'dotenv';
import pool from './config/database.js';

dotenv.config();

const addAvailability = async () => {
  const client = await pool.connect();
  try {
    // Find user by email
    const userResult = await client.query(
      'SELECT id, user_name, email FROM Users WHERE email = $1',
      ['shuklashobhit111@gmail.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found with email: shuklashobhit111@gmail.com');
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.user_name} (ID: ${user.id})`);

    // Check existing availability
    const existingAvailability = await client.query(
      'SELECT * FROM Availability WHERE user_id = $1',
      [user.id]
    );

    if (existingAvailability.rows.length > 0) {
      console.log(`⚠️  User already has ${existingAvailability.rows.length} availability slots`);
      console.log('Existing slots:', existingAvailability.rows);
      return;
    }

    // Add availability for Monday to Friday, 9 AM to 5 PM
    const availabilitySlots = [
      { day: 1, start: '09:00:00', end: '17:00:00' }, // Monday
      { day: 2, start: '09:00:00', end: '17:00:00' }, // Tuesday
      { day: 3, start: '09:00:00', end: '17:00:00' }, // Wednesday
      { day: 4, start: '09:00:00', end: '17:00:00' }, // Thursday
      { day: 5, start: '09:00:00', end: '17:00:00' }, // Friday
      { day: 6, start: '10:00:00', end: '14:00:00' }, // Saturday (shorter hours)
    ];

    console.log('\n📅 Adding availability slots...');

    for (const slot of availabilitySlots) {
      await client.query(
        `INSERT INTO Availability (user_id, day_of_week, start_time, end_time, is_enabled)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, slot.day, slot.start, slot.end, true]
      );
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      console.log(`✅ Added: ${dayNames[slot.day]} ${slot.start} - ${slot.end}`);
    }

    console.log('\n🎉 Successfully added availability slots!');
    console.log(`Total slots added: ${availabilitySlots.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    pool.end();
  }
};

addAvailability();
