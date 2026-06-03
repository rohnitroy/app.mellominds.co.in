import pool from '../config/database.js';

export default async function addTeamSeatsColumn() {
  try {
    // Add purchased_seats column to users table
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS purchased_seats INTEGER DEFAULT 0;
    `);
    console.log('✓ Added purchased_seats column to users table');

    // Set purchased_seats = 1 for existing team plan users
    await pool.query(`
      UPDATE users
      SET purchased_seats = 1
      WHERE plan_name = 'team' AND purchased_seats = 0;
    `);
    console.log('✓ Set purchased_seats = 1 for existing team users');

  } catch (err) {
    console.error('Error adding team seats column:', err);
    throw err;
  }
}
