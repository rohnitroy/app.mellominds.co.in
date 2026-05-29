import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

// Create direct pool connection with explicit host
const pool = new Pool({
  host: process.env.DB_HOST || '187.127.140.201',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mello_db',
  user: process.env.DB_USER || 'mello_admin',
  password: process.env.DB_PASSWORD || 'Mello@dbadmin',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const DEMO_EMAIL = 'demo@mellominds.co.in';
const DEMO_PASSWORD = 'admin@123';
const DEMO_NAME = 'Demo Therapist';

async function createDemoUser() {
  try {
    console.log('🚀 Creating demo user...\n');

    // 1. Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM Users WHERE email = $1',
      [DEMO_EMAIL]
    );

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log(`✅ Demo user already exists (ID: ${userId})`);
    } else {
      // 2. Hash password
      const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

      // 3. Create user
      const userResult = await pool.query(
        `INSERT INTO Users (
          email, password_hash, user_name, auth_provider, plan_name, 
          phone, specializations, bio, profile_picture
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          DEMO_EMAIL,
          hashedPassword,
          DEMO_NAME,
          'email',
          'enterprise',
          '+91 98765 43210',
          ['Anxiety', 'Depression', 'Stress Management'],
          'Demo therapist account for testing MelloMinds platform',
          null
        ]
      );

      userId = userResult.rows[0].id;
      console.log(`✅ Demo user created successfully (ID: ${userId})`);
      console.log(`   Email: ${DEMO_EMAIL}`);
      console.log(`   Password: ${DEMO_PASSWORD}`);
      console.log(`   Plan: Enterprise\n`);
    }

    // 4. Create demo calendars
    console.log('📅 Creating demo calendars...');
    const calendars = [
      {
        title: 'Individual Sessions',
        description: 'One-on-one therapy sessions',
        duration: '60'
      },
      {
        title: 'Couples Therapy',
        description: 'Couples counseling sessions',
        duration: '90'
      },
      {
        title: 'Group Sessions',
        description: 'Group therapy sessions',
        duration: '120'
      }
    ];

    const calendarIds = [];
    for (const cal of calendars) {
      const calResult = await pool.query(
        `INSERT INTO Calendars (
          user_id, title, description, duration, is_active
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [userId, cal.title, cal.description, cal.duration, true]
      );
      calendarIds.push(calResult.rows[0].id);
      console.log(`   ✅ ${cal.title}`);
    }

    // 5. Create demo clients
    console.log('\n👥 Creating demo clients...');
    const clients = [
      {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+91 98765 43211',
        age: 28,
        gender: 'Male',
        maritalStatus: 'Single'
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+91 98765 43212',
        age: 32,
        gender: 'Female',
        maritalStatus: 'Married'
      },
      {
        name: 'Robert Johnson',
        email: 'robert@example.com',
        phone: '+91 98765 43213',
        age: 45,
        gender: 'Male',
        maritalStatus: 'Divorced'
      }
    ];

    const clientIds = [];
    for (const client of clients) {
      const clientResult = await pool.query(
        `INSERT INTO Clients (
          therapist_id, name, email, phone, age, gender, marital_status, manually_added
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [userId, client.name, client.email, client.phone, client.age, client.gender, client.maritalStatus, true]
      );
      clientIds.push(clientResult.rows[0].id);
      console.log(`   ✅ ${client.name}`);
    }

    // 6. Create demo appointments
    console.log('\n📅 Creating demo appointments...');
    const now = new Date();
    const appointments = [
      {
        clientId: clientIds[0],
        calendarId: calendarIds[0],
        startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        status: 'confirmed'
      },
      {
        clientId: clientIds[1],
        calendarId: calendarIds[1],
        startTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        status: 'confirmed'
      },
      {
        clientId: clientIds[2],
        calendarId: calendarIds[0],
        startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'confirmed'
      }
    ];

    for (const appt of appointments) {
      const duration = await pool.query(
        'SELECT duration FROM Calendars WHERE id = $1',
        [appt.calendarId]
      );
      const durationMins = parseInt(duration.rows[0].duration);
      const endTime = new Date(appt.startTime.getTime() + durationMins * 60 * 1000);
      const appointmentDate = new Date(appt.startTime);
      appointmentDate.setHours(0, 0, 0, 0);

      const clientData = await pool.query('SELECT name, email FROM Clients WHERE id = $1', [appt.clientId]);

      await pool.query(
        `INSERT INTO Appointments (
          therapist_id, client_id, calendar_id, client_name, client_email,
          appointment_date, start_time, end_time, status, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          appt.clientId,
          appt.calendarId,
          clientData.rows[0].name,
          clientData.rows[0].email,
          appointmentDate,
          appt.startTime,
          endTime,
          appt.status,
          'pending'
        ]
      );
      console.log(`   ✅ Appointment created for ${appt.startTime.toDateString()}`);
    }

    // 7. Create demo session notes
    console.log('\n📝 Creating demo session notes...');
    const sessionNotes = [
      {
        clientId: clientIds[0],
        title: 'Initial Assessment',
        content: 'Client presented with anxiety symptoms. Discussed family history and current stressors. Recommended CBT approach.'
      },
      {
        clientId: clientIds[1],
        title: 'Follow-up Session',
        content: 'Good progress observed. Client reported improved sleep patterns. Continue with current treatment plan.'
      },
      {
        clientId: clientIds[2],
        title: 'Couples Session',
        content: 'Discussed communication patterns. Both partners engaged well. Assigned homework exercises.'
      }
    ];

    for (const note of sessionNotes) {
      await pool.query(
        `INSERT INTO SessionNotes (
          therapist_id, client_id, title, content
        ) VALUES ($1, $2, $3, $4)`,
        [userId, note.clientId, note.title, note.content]
      );
      console.log(`   ✅ ${note.title}`);
    }

    // 8. Create demo availability
    console.log('\n⏰ Creating demo availability...');
    const availability = [
      { day: 1, start: '09:00', end: '18:00' }, // Monday
      { day: 2, start: '09:00', end: '18:00' }, // Tuesday
      { day: 3, start: '10:00', end: '17:00' }, // Wednesday
      { day: 4, start: '09:00', end: '18:00' }, // Thursday
      { day: 5, start: '09:00', end: '17:00' }, // Friday
    ];

    for (const avail of availability) {
      await pool.query(
        `INSERT INTO Availability (
          user_id, day_of_week, start_time, end_time, is_enabled
        ) VALUES ($1, $2, $3, $4, $5)`,
        [userId, avail.day, avail.start, avail.end, true]
      );
    }
    console.log(`   ✅ Availability set for Mon-Fri`);

    // 9. Create demo notifications
    console.log('\n🔔 Creating demo notifications...');
    const notifications = [
      {
        type: 'booking_confirmation',
        title: 'New Booking',
        description: 'John Doe has booked a session for tomorrow'
      },
      {
        type: 'payment_received',
        title: 'Payment Received',
        description: 'Payment of ₹1000 received from Jane Smith'
      },
      {
        type: 'reminder',
        title: 'Session Reminder',
        description: 'You have a session with Robert Johnson in 1 hour'
      }
    ];

    for (const notif of notifications) {
      await pool.query(
        `INSERT INTO Notifications (
          user_id, type, title, description, is_read
        ) VALUES ($1, $2, $3, $4, $5)`,
        [userId, notif.type, notif.title, notif.description, false]
      );
    }
    console.log(`   ✅ ${notifications.length} notifications created`);

    // 10. Set email preferences
    console.log('\n📧 Setting email preferences...');
    await pool.query(
      `UPDATE Users SET email_preferences = $1 WHERE id = $2`,
      [
        JSON.stringify({
          booking_confirmation: true,
          booking_confirmation_therapist: true,
          cancellation: true,
          reschedule: true,
          session_reminder: true,
          session_reminder_30min: true,
          activity_notification: true,
          invoice: true,
          booking_link: true,
          transfer_request: true,
          transfer_status: true,
          use_own_email: false
        }),
        userId
      ]
    );
    console.log(`   ✅ Email preferences configured`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEMO USER SETUP COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📧 Email: ${DEMO_EMAIL}`);
    console.log(`🔐 Password: ${DEMO_PASSWORD}`);
    console.log(`\n📊 Demo Data Created:`);
    console.log(`   • 1 User (Enterprise Plan)`);
    console.log(`   • 3 Calendars`);
    console.log(`   • 3 Clients`);
    console.log(`   • 3 Appointments`);
    console.log(`   • 3 Session Notes`);
    console.log(`   • 5 Availability Slots`);
    console.log(`   • 3 Notifications`);
    console.log(`\n🚀 Ready to test! Login at http://localhost:5173\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating demo user:', err.message);
    console.error(err);
    process.exit(1);
  }
}

createDemoUser();
