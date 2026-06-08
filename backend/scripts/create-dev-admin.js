import bcrypt from 'bcrypt';
import pool from '../config/database.js';

async function createDevAdmin() {
  try {
    const email = 'mellomindsventure@gmail.com';
    const password = 'rohnit9141';
    const userName = 'Aastha Saraf';

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email.toLowerCase()]);

    if (existing.rows.length > 0) {
      console.log('User already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2', [hashedPassword, email.toLowerCase()]);
      console.log('✅ Dev admin user password updated');
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (user_name, email, password_hash, plan_name, account_status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, user_name, email, plan_name`,
      [userName, email, hashedPassword, 'enterprise', 'active']
    );

    console.log('✅ Dev admin user created successfully:');
    console.log('   Email:', result.rows[0].email);
    console.log('   Name:', result.rows[0].user_name);
    console.log('   Plan:', result.rows[0].plan_name);
    console.log('   ID:', result.rows[0].id);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating dev admin:', err.message);
    process.exit(1);
  }
}

createDevAdmin();
