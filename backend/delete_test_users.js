import pool from './config/database.js';

const emailsToDelete = [
  'test-google-1779903523144@example.com',
  'test-1779903189534@gmail.com',
  'rohnitroy.digitalite@gmail.com',
  'rohnit@fluid.live',
  'rohnitroy.yt@gmail.com'
];

async function deleteUsers() {
  try {
    console.log('🗑️  Deleting test users...\n');
    
    for (const email of emailsToDelete) {
      const result = await pool.query('DELETE FROM users WHERE email = $1', [email]);
      if (result.rowCount > 0) {
        console.log(`✅ Deleted: ${email}`);
      } else {
        console.log(`⚠️  Not found: ${email}`);
      }
    }
    
    console.log('\n✅ Done!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

deleteUsers();
