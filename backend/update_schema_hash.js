import pool from './config/database.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function updateHash() {
  try {
    const EXPECTED_SCHEMA = {
      users: ['id', 'email', 'password', 'google_id', 'auth_provider', 'user_name', 'phone', 'plan_name', 'org_role', 'org_owner_id', 'dob', 'gender', 'language_spoken', 'country', 'state', 'city', 'pincode', 'clinic_address', 'profile_picture', 'reset_token', 'reset_token_expires', 'created_at', 'updated_at'],
      chat_messages: ['id', 'conversation_id', 'message_type', 'content', 'metadata', 'created_at'],
      chat_conversations: ['id', 'user_id', 'title', 'context_data', 'is_active', 'created_at', 'updated_at'],
      appointments: ['id', 'therapist_id', 'client_id', 'start_time', 'end_time', 'status', 'created_at'],
      clients: ['id', 'therapist_id', 'email', 'phone', 'created_at'],
      enterprise_leads: ['id', 'name', 'phone', 'email', 'company_name', 'created_at']
    };

    const schemaInfo = {};
    for (const tableName of Object.keys(EXPECTED_SCHEMA)) {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      schemaInfo[tableName] = result.rows;
    }

    const hash = crypto.createHash('sha256').update(JSON.stringify(schemaInfo)).digest('hex');
    const hashFile = path.join(__dirname, 'security', '.schema-hash');
    
    fs.writeFileSync(hashFile, hash, 'utf8');
    console.log('✅ Schema hash updated:', hash);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateHash();
