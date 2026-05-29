import pool from './config/database.js';

async function listUsers() {
  try {
    console.log('📋 Fetching all users from database...\n');

    const result = await pool.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        user_name,
        phone,
        is_therapist,
        plan_name,
        org_role,
        auth_provider,
        google_id,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log('❌ No users found in the database');
      await pool.end();
      process.exit(0);
    }

    console.log(`✅ Found ${result.rows.length} user(s):\n`);
    console.table(result.rows);

    console.log('\n📊 User Summary:');
    console.log(`Total Users: ${result.rows.length}`);
    console.log(`Therapists: ${result.rows.filter(u => u.is_therapist).length}`);
    console.log(`Enterprise Users: ${result.rows.filter(u => u.plan_name === 'enterprise').length}`);
    console.log(`Google OAuth Users: ${result.rows.filter(u => u.auth_provider === 'google').length}`);
    console.log(`Email Users: ${result.rows.filter(u => u.auth_provider === 'email').length}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

listUsers();
