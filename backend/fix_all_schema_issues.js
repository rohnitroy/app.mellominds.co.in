import pool from './config/database.js';

async function fixAllSchemaIssues() {
  try {
    console.log('🔧 Fixing All Schema Issues...\n');

    // 1. Fix Users table - add missing columns
    console.log('1️⃣ Fixing Users table...');
    const userFixes = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS specializations TEXT[]`,
    ];
    for (const sql of userFixes) {
      try {
        await pool.query(sql);
        console.log(`  ✓ ${sql.substring(0, 50)}...`);
      } catch (err) {
        if (err.code === '42701') console.log(`  ✓ Column already exists`);
        else console.error(`  ❌ ${err.message}`);
      }
    }

    // 2. Fix Appointments table - add missing columns
    console.log('\n2️⃣ Fixing Appointments table...');
    const appointmentFixes = [
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_email VARCHAR(255)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS therapist_email VARCHAR(255)`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS title VARCHAR(255)`,
    ];
    for (const sql of appointmentFixes) {
      try {
        await pool.query(sql);
        console.log(`  ✓ ${sql.substring(0, 50)}...`);
      } catch (err) {
        if (err.code === '42701') console.log(`  ✓ Column already exists`);
        else console.error(`  ❌ ${err.message}`);
      }
    }

    // 3. Fix Clients table - add missing columns
    console.log('\n3️⃣ Fixing Clients table...');
    const clientFixes = [
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`,
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`,
    ];
    for (const sql of clientFixes) {
      try {
        await pool.query(sql);
        console.log(`  ✓ ${sql.substring(0, 50)}...`);
      } catch (err) {
        if (err.code === '42701') console.log(`  ✓ Column already exists`);
        else console.error(`  ❌ ${err.message}`);
      }
    }

    // 4. Populate first_name and last_name from name column
    console.log('\n4️⃣ Populating first_name and last_name from name...');
    try {
      await pool.query(`
        UPDATE clients 
        SET 
          first_name = COALESCE(first_name, SPLIT_PART(name, ' ', 1)),
          last_name = COALESCE(last_name, SPLIT_PART(name, ' ', 2))
        WHERE first_name IS NULL OR last_name IS NULL
      `);
      console.log('  ✓ Updated first_name and last_name');
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }

    // 5. Populate client_email and therapist_email in appointments
    console.log('\n5️⃣ Populating client_email and therapist_email in appointments...');
    try {
      await pool.query(`
        UPDATE appointments a
        SET 
          client_email = COALESCE(a.client_email, c.email),
          therapist_email = COALESCE(a.therapist_email, u.email)
        FROM clients c, users u
        WHERE a.client_id = c.id 
          AND a.therapist_id = u.id
          AND (a.client_email IS NULL OR a.therapist_email IS NULL)
      `);
      console.log('  ✓ Updated client_email and therapist_email');
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }

    // 6. Populate title in appointments
    console.log('\n6️⃣ Populating title in appointments...');
    try {
      await pool.query(`
        UPDATE appointments 
        SET title = COALESCE(title, 'Session with ' || (SELECT name FROM clients WHERE id = client_id))
        WHERE title IS NULL
      `);
      console.log('  ✓ Updated title');
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }

    console.log('\n✅ All schema issues fixed!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixAllSchemaIssues();
