import pool from './config/database.js';

async function checkCalendars() {
  try {
    console.log('Checking Calendars table...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'calendars'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Calendars table columns:');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });
    
    const count = await pool.query('SELECT COUNT(*) FROM Calendars');
    console.log(`\n✅ Total calendars in DB: ${count.rows[0].count}`);
    
    // Check if form_data column exists
    const formDataCheck = result.rows.find(r => r.column_name === 'form_data');
    if (formDataCheck) {
      console.log('✅ form_data column exists');
    } else {
      console.log('❌ form_data column missing');
    }
    
    // Check if schedule_settings column exists
    const scheduleCheck = result.rows.find(r => r.column_name === 'schedule_settings');
    if (scheduleCheck) {
      console.log('✅ schedule_settings column exists');
    } else {
      console.log('❌ schedule_settings column missing');
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkCalendars();
