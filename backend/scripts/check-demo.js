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

async function checkDemo() {
  try {
    const user = await pool.query('SELECT id, email, user_name, plan_name FROM Users WHERE email = $1', ['demo@mellominds.co.in']);
    
    if (user.rows.length === 0) {
      console.log('❌ Demo user not found');
      process.exit(1);
    }

    const userId = user.rows[0].id;
    const calendars = await pool.query('SELECT COUNT(*) FROM Calendars WHERE user_id = $1', [userId]);
    const clients = await pool.query('SELECT COUNT(*) FROM Clients WHERE therapist_id = $1', [userId]);
    const appointments = await pool.query('SELECT COUNT(*) FROM Appointments WHERE therapist_id = $1', [userId]);
    const notes = await pool.query('SELECT COUNT(*) FROM SessionNotes WHERE therapist_id = $1', [userId]);
    const notifications = await pool.query('SELECT COUNT(*) FROM Notifications WHERE user_id = $1', [userId]);

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEMO USER SETUP COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📧 Email: demo@mellominds.co.in`);
    console.log(`🔐 Password: admin@123`);
    console.log(`👤 Name: ${user.rows[0].user_name}`);
    console.log(`📊 Plan: ${user.rows[0].plan_name}`);
    console.log(`\n📊 Demo Data Created:`);
    console.log(`   • 1 User (Enterprise Plan)`);
    console.log(`   • ${calendars.rows[0].count} Calendars`);
    console.log(`   • ${clients.rows[0].count} Clients`);
    console.log(`   • ${appointments.rows[0].count} Appointments`);
    console.log(`   • ${notes.rows[0].count} Session Notes`);
    console.log(`   • ${notifications.rows[0].count} Notifications`);
    console.log(`\n🚀 Ready to test! Login at http://localhost:5173\n`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkDemo();
