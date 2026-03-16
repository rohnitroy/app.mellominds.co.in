import dotenv from 'dotenv';
import pool from './config/database.js';

dotenv.config();

const addTestAppointment = async () => {
  const client = await pool.connect();
  try {
    // Find user
    const userResult = await client.query(
      'SELECT id, user_name, email FROM Users WHERE email = $1',
      ['shuklashobhit111@gmail.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.user_name} (ID: ${user.id})`);

    // Get user's calendars
    const calendarResult = await client.query(
      'SELECT id, title, slug FROM Calendars WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    let calendarId = null;
    if (calendarResult.rows.length > 0) {
      calendarId = calendarResult.rows[0].id;
      console.log(`✅ Found calendar: ${calendarResult.rows[0].title} (ID: ${calendarId})`);
    } else {
      console.log('⚠️  No calendar found, appointment will be created without calendar_id');
    }

    // Create appointment for tomorrow at 2 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0); // 2:00 PM
    
    const endTime = new Date(tomorrow);
    endTime.setHours(15, 0, 0, 0); // 3:00 PM (1 hour session)

    const appointmentData = {
      therapist_id: user.id,
      calendar_id: calendarId,
      title: 'Test Therapy Session',
      start_time: tomorrow.toISOString(),
      end_time: endTime.toISOString(),
      status: 'scheduled',
      client_email: 'testclient@example.com',
      client_name: 'Test Client',
      client_phone: '9876543210',
      meet_link: 'https://meet.google.com/test-link'
    };

    const result = await client.query(
      `INSERT INTO Appointments 
       (therapist_id, calendar_id, title, start_time, end_time, status, client_email, client_name, client_phone, meet_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        appointmentData.therapist_id,
        appointmentData.calendar_id,
        appointmentData.title,
        appointmentData.start_time,
        appointmentData.end_time,
        appointmentData.status,
        appointmentData.client_email,
        appointmentData.client_name,
        appointmentData.client_phone,
        appointmentData.meet_link
      ]
    );

    console.log('\n🎉 Test appointment created successfully!');
    console.log('📅 Details:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Title: ${result.rows[0].title}`);
    console.log(`   Client: ${result.rows[0].client_name} (${result.rows[0].client_email})`);
    console.log(`   Start: ${new Date(result.rows[0].start_time).toLocaleString()}`);
    console.log(`   End: ${new Date(result.rows[0].end_time).toLocaleString()}`);
    console.log(`   Status: ${result.rows[0].status}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    pool.end();
  }
};

addTestAppointment();
