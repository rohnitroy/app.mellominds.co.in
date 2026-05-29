/**
 * Migration script to add encryption to existing sensitive data
 * 
 * This script:
 * 1. Adds new encrypted columns to the database
 * 2. Migrates existing plaintext data to encrypted format
 * 3. Handles the migration gracefully for existing records
 * 
 * Run with: node scripts/migrate_encryption.js
 */

import '../config/env.js';
import pool from '../config/database.js';
import { encryptSensitiveData, encryptJSONB } from '../lib/encryption.js';

async function migrateEncryption() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting encryption migration...');
    
    // Step 1: Add encrypted columns to Clients table
    console.log('📝 Adding encrypted columns to Clients table...');
    await client.query(`
      ALTER TABLE Clients 
      ADD COLUMN IF NOT EXISTS emergency_name_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS emergency_phone_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS emergency_relation_encrypted TEXT
    `);
    
    // Step 2: Add encrypted columns to SessionNotes table
    console.log('📝 Adding encrypted columns to SessionNotes table...');
    await client.query(`
      ALTER TABLE SessionNotes 
      ADD COLUMN IF NOT EXISTS note_content_encrypted TEXT
    `);
    
    // Step 3: Add encrypted columns to Appointments table
    console.log('📝 Adding encrypted columns to Appointments table...');
    await client.query(`
      ALTER TABLE Appointments 
      ADD COLUMN IF NOT EXISTS form_responses_encrypted TEXT
    `);
    
    // Step 4: Add encrypted columns to UserIntegrations table (for OAuth tokens)
    console.log('📝 Adding encrypted columns to UserIntegrations table...');
    await client.query(`
      ALTER TABLE UserIntegrations 
      ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS secret_key_encrypted TEXT
    `);
    
    console.log('✅ Database schema updated successfully');
    
    // Step 5: Migrate existing client data
    console.log('🔄 Migrating existing client data...');
    const clientsResult = await client.query(`
      SELECT id, therapist_id, emergency_name, emergency_phone, emergency_relation 
      FROM Clients 
      WHERE emergency_name_encrypted IS NULL 
         OR emergency_phone_encrypted IS NULL 
         OR emergency_relation_encrypted IS NULL
    `);
    
    let clientsUpdated = 0;
    for (const client_row of clientsResult.rows) {
      const userId = client_row.therapist_id;
      
      const encryptedEmergencyName = client_row.emergency_name 
        ? encryptSensitiveData(client_row.emergency_name, userId) 
        : null;
      const encryptedEmergencyPhone = client_row.emergency_phone 
        ? encryptSensitiveData(client_row.emergency_phone, userId) 
        : null;
      const encryptedEmergencyRelation = client_row.emergency_relation 
        ? encryptSensitiveData(client_row.emergency_relation, userId) 
        : null;
      
      await client.query(`
        UPDATE Clients 
        SET emergency_name_encrypted = $1,
            emergency_phone_encrypted = $2,
            emergency_relation_encrypted = $3
        WHERE id = $4
      `, [encryptedEmergencyName, encryptedEmergencyPhone, encryptedEmergencyRelation, client_row.id]);
      
      clientsUpdated++;
    }
    console.log(`✅ Migrated ${clientsUpdated} client records`);
    
    // Step 6: Migrate existing session notes
    console.log('🔄 Migrating existing session notes...');
    const notesResult = await client.query(`
      SELECT sn.id, sn.therapist_id, sn.note_content 
      FROM SessionNotes sn 
      WHERE sn.note_content_encrypted IS NULL 
        AND sn.note_content IS NOT NULL
    `);
    
    let notesUpdated = 0;
    for (const note_row of notesResult.rows) {
      const userId = note_row.therapist_id;
      
      const encryptedNoteContent = note_row.note_content 
        ? encryptJSONB(note_row.note_content, userId) 
        : null;
      
      await client.query(`
        UPDATE SessionNotes 
        SET note_content_encrypted = $1
        WHERE id = $2
      `, [encryptedNoteContent, note_row.id]);
      
      notesUpdated++;
    }
    console.log(`✅ Migrated ${notesUpdated} session note records`);
    
    // Step 7: Migrate existing appointment form responses
    console.log('🔄 Migrating existing appointment form responses...');
    const appointmentsResult = await client.query(`
      SELECT id, therapist_id, form_responses 
      FROM Appointments 
      WHERE form_responses_encrypted IS NULL 
        AND form_responses IS NOT NULL
    `);
    
    let appointmentsUpdated = 0;
    for (const appt_row of appointmentsResult.rows) {
      const userId = appt_row.therapist_id;
      
      const encryptedFormResponses = appt_row.form_responses 
        ? encryptJSONB(appt_row.form_responses, userId) 
        : null;
      
      await client.query(`
        UPDATE Appointments 
        SET form_responses_encrypted = $1
        WHERE id = $2
      `, [encryptedFormResponses, appt_row.id]);
      
      appointmentsUpdated++;
    }
    console.log(`✅ Migrated ${appointmentsUpdated} appointment records`);
    
    // Step 8: Migrate existing user integrations (OAuth tokens)
    console.log('🔄 Migrating existing user integration tokens...');
    const integrationsResult = await client.query(`
      SELECT id, user_id, access_token, refresh_token, secret_key 
      FROM UserIntegrations 
      WHERE access_token_encrypted IS NULL 
         OR refresh_token_encrypted IS NULL 
         OR secret_key_encrypted IS NULL
    `);
    
    let integrationsUpdated = 0;
    for (const integration_row of integrationsResult.rows) {
      const userId = integration_row.user_id;
      
      const encryptedAccessToken = integration_row.access_token 
        ? encryptSensitiveData(integration_row.access_token, userId) 
        : null;
      const encryptedRefreshToken = integration_row.refresh_token 
        ? encryptSensitiveData(integration_row.refresh_token, userId) 
        : null;
      const encryptedSecretKey = integration_row.secret_key 
        ? encryptSensitiveData(integration_row.secret_key, userId) 
        : null;
      
      await client.query(`
        UPDATE UserIntegrations 
        SET access_token_encrypted = $1,
            refresh_token_encrypted = $2,
            secret_key_encrypted = $3
        WHERE id = $4
      `, [encryptedAccessToken, encryptedRefreshToken, encryptedSecretKey, integration_row.id]);
      
      integrationsUpdated++;
    }
    console.log(`✅ Migrated ${integrationsUpdated} user integration records`);
    
    console.log('🎉 Encryption migration completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   • ${clientsUpdated} client records encrypted`);
    console.log(`   • ${notesUpdated} session note records encrypted`);
    console.log(`   • ${appointmentsUpdated} appointment records encrypted`);
    console.log(`   • ${integrationsUpdated} integration records encrypted`);
    console.log('');
    console.log('⚠️  IMPORTANT: The old plaintext columns are still present.');
    console.log('   After verifying the migration worked correctly, you can drop them with:');
    console.log('   • ALTER TABLE Clients DROP COLUMN emergency_name, DROP COLUMN emergency_phone, DROP COLUMN emergency_relation;');
    console.log('   • ALTER TABLE SessionNotes DROP COLUMN note_content;');
    console.log('   • ALTER TABLE Appointments DROP COLUMN form_responses;');
    console.log('   • ALTER TABLE UserIntegrations DROP COLUMN access_token, DROP COLUMN refresh_token, DROP COLUMN secret_key;');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateEncryption()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrateEncryption;