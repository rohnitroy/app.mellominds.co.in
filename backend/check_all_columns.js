import pool from './config/database.js';

async function checkColumns() {
  try {
    console.log('📋 Checking all table columns...\n');

    const tables = ['users', 'appointments', 'clients', 'bookings'];

    for (const table of tables) {
      console.log(`\n${table.toUpperCase()} Table Columns:`);
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      console.table(result.rows);
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkColumns();
