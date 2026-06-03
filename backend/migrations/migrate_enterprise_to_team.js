import pool from '../config/database.js';

export default async function migrateEnterpriseToTeam() {
  try {
    // Migrate existing 'enterprise' plan users to 'team'
    const result = await pool.query(`
      UPDATE users
      SET plan_name = 'team'
      WHERE plan_name = 'enterprise'
      RETURNING id, email, plan_name
    `);

    console.log(`✓ Migrated ${result.rows.length} users from 'enterprise' plan to 'team' plan`);

    if (result.rows.length > 0) {
      console.log('Migrated users:');
      result.rows.forEach(row => {
        console.log(`  - ${row.email} (ID: ${row.id})`);
      });
    }

  } catch (err) {
    console.error('Error migrating enterprise to team:', err);
    throw err;
  }
}
