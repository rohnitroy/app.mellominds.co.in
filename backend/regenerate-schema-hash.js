#!/usr/bin/env node

/**
 * Regenerate Schema Hash
 * Run this after making schema changes to update the stored hash
 */

import pool from './config/database.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXPECTED_SCHEMA = {
  users: ['id', 'email', 'password', 'google_id', 'auth_provider', 'user_name', 'phone', 'plan_name', 'org_role', 'org_owner_id', 'dob', 'gender', 'language_spoken', 'country', 'state', 'city', 'pincode', 'clinic_address', 'profile_picture', 'reset_token', 'reset_token_expires', 'created_at', 'updated_at', 'profile_slug', 'profile_slug_updated_at', 'specialization', 'specializations'],
  chat_messages: ['id', 'conversation_id', 'message_type', 'content', 'metadata', 'created_at'],
  chat_conversations: ['id', 'user_id', 'title', 'context_data', 'is_active', 'created_at', 'updated_at'],
  appointments: ['id', 'therapist_id', 'client_id', 'start_time', 'end_time', 'status', 'created_at', 'appointment_date', 'duration_minutes', 'notes', 'updated_at', 'client_phone', 'payment_status', 'payment_amount', 'form_responses', 'location_type', 'cancel_token', 'cashfree_order_id', 'cashfree_payment_link', 'razorpay_order_id', 'razorpay_payment_id', 'client_email', 'therapist_email', 'title', 'calendar_id'],
  clients: ['id', 'therapist_id', 'first_name', 'last_name', 'email', 'phone', 'created_at', 'name', 'age', 'occupation', 'gender', 'marital_status', 'emergency_name', 'emergency_phone', 'emergency_relation', 'updated_at', 'manually_added', 'clinical_profile_url', 'emergency_name_encrypted', 'emergency_phone_encrypted', 'emergency_relation_encrypted'],
  enterprise_leads: ['id', 'name', 'phone', 'email', 'company_name', 'created_at', 'company_website']
};

async function generateSchemaHash() {
  try {
    console.log('🔄 Generating new schema hash...');
    
    const schemaInfo = {};

    for (const tableName of Object.keys(EXPECTED_SCHEMA)) {
      try {
        const result = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);

        schemaInfo[tableName] = result.rows;
        console.log(`✅ ${tableName}: ${result.rows.length} columns`);
      } catch (error) {
        console.warn(`⚠️ ${tableName}: Could not read schema (table may not exist)`);
      }
    }

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(schemaInfo))
      .digest('hex');

    return hash;
  } catch (error) {
    console.error('❌ Error generating schema hash:', error.message);
    process.exit(1);
  }
}

async function storeSchemaHash(hash) {
  try {
    const hashFile = path.join(__dirname, '.schema-hash');
    const securityHashFile = path.join(__dirname, 'security', '.schema-hash');
    
    fs.writeFileSync(hashFile, hash, 'utf8');
    fs.writeFileSync(securityHashFile, hash, 'utf8');
    
    console.log(`✅ Schema hash stored successfully`);
    console.log(`📝 Hash: ${hash}`);
    
    return hash;
  } catch (error) {
    console.error('❌ Error storing schema hash:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    console.log('🔐 Schema Hash Regeneration Tool\n');
    
    const hash = await generateSchemaHash();
    await storeSchemaHash(hash);
    
    console.log('\n✅ Schema hash regenerated successfully!');
    console.log('You can now deploy the application.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
