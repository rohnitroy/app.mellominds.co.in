/**
 * Setup PostgreSQL Row Level Security (RLS) for data isolation
 * 
 * This script enables RLS on sensitive tables and creates policies
 * to ensure users can only access their own data at the database level.
 * 
 * Run with: node scripts/setup_row_level_security.js
 */

import '../config/env.js';
import pool from '../config/database.js';

async function setupRowLevelSecurity() {
  const client = await pool.connect();
  
  try {
    console.log('🔒 Setting up Row Level Security...');
    
    // Enable RLS on sensitive tables
    console.log('📝 Enabling RLS on Clients table...');
    await client.query('ALTER TABLE Clients ENABLE ROW LEVEL SECURITY');
    
    console.log('📝 Enabling RLS on SessionNotes table...');
    await client.query('ALTER TABLE SessionNotes ENABLE ROW LEVEL SECURITY');
    
    console.log('📝 Enabling RLS on ClientActivities table...');
    await client.query('ALTER TABLE ClientActivities ENABLE ROW LEVEL SECURITY');
    
    console.log('📝 Enabling RLS on Appointments table...');
    await client.query('ALTER TABLE Appointments ENABLE ROW LEVEL SECURITY');
    
    console.log('📝 Enabling RLS on Calendars table...');
    await client.query('ALTER TABLE Calendars ENABLE ROW LEVEL SECURITY');
    
    console.log('📝 Enabling RLS on UserIntegrations table...');
    await client.query('ALTER TABLE UserIntegrations ENABLE ROW LEVEL SECURITY');
    
    // Create RLS policies for Clients table
    console.log('🛡️  Creating RLS policies for Clients...');
    await client.query(`
      CREATE POLICY clients_isolation ON Clients
      FOR ALL
      TO mello_admin
      USING (therapist_id = current_setting('app.current_user_id')::int)
      WITH CHECK (therapist_id = current_setting('app.current_user_id')::int)
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('   Policy already exists, skipping...');
    });
    
    // Create RLS policies for SessionNotes table
    console.log('🛡️  Creating RLS policies for SessionNotes...');
    await client.query(`
      CREATE POLICY session_notes_isolation ON SessionNotes
      FOR ALL
      TO mello_admin
      USING (therapist_id = current_setting('app.current_user_id')::int)
      WITH CHECK (therapist_id = current_setting('app.current_user_id')::int)
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('   Policy already exists, skipping...');
    });
    
    // Create RLS policies for ClientActivities table
    console.log('🛡️  Creating RLS policies for ClientActivities...');
    await client.query(`
      CREATE POLICY client_activities_isolation ON ClientActivities
      FOR ALL
      TO mello_admin
      USING (therapist_id = current_setting('app.current_user_id')::int)
      WITH CHECK (therapist_id = current_setting('app.current_user_id')::int)
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('   Policy already exists, skipping...');
    });
    
    // Create RLS policies for Appointments table
    console.log('🛡️  Creating RLS policies for Appointments...');
    await client.query(`
      CREATE POLICY appointments_isolation ON Appointments
      FOR ALL
      TO mello_admin
      USING (therapist_id = current_setting('app.current_user_id')::int)
      WITH CHECK (therapist_id = current_setting('app.current_user_id')::int)
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('   Policy already exists, skipping...');
    });
    
    // Create RLS policies for Calendars table
    console.log('🛡️  Creating RLS policies for Calendars...');
    await client.query(`
      CREATE POLICY calendars_isolation ON Calendars
      FOR ALL
      TO mello_admin
      USING (user_id = current_setting('app.current_user_id')::int)
      WITH CHECK (user_id = current_setting('app.current_user_id')::int)
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('   Policy already exists, skipping...');
    });
    
    // Create RLS policies for UserIntegrations table
    console.log('🛡️  Creating RLS policies for UserIntegrations...');
    await client.query(`
      CREATE POLICY user_integrations_isolation ON UserIntegrations
      FOR ALL
      TO mello_admin
      USING (user_id = current_setting('app.current_user_id')::int)
      WITH CHECK (user_id = current_setting('app.current_user_id')::int)
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('   Policy already exists, skipping...');
    });
    
    console.log('✅ Row Level Security setup completed successfully!');
    console.log('');
    console.log('📋 RLS is now enabled on:');
    console.log('   • Clients table');
    console.log('   • SessionNotes table');
    console.log('   • ClientActivities table');
    console.log('   • Appointments table');
    console.log('   • Calendars table');
    console.log('   • UserIntegrations table');
    console.log('');
    console.log('⚠️  IMPORTANT: Your application must now set the current_user_id');
    console.log('   session variable before making queries. Add this to your auth middleware:');
    console.log('   await pool.query("SET app.current_user_id = $1", [req.user.id]);');
    
  } catch (error) {
    console.error('❌ RLS setup failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the setup
if (import.meta.url === `file://${process.argv[1]}`) {
  setupRowLevelSecurity()
    .then(() => {
      console.log('RLS setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('RLS setup failed:', error);
      process.exit(1);
    });
}

export default setupRowLevelSecurity;