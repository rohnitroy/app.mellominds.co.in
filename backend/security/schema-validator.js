import pool from '../config/database.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Schema Validator - Ensures database schema hasn't been tampered with
 * Runs on server startup and periodically
 */

const EXPECTED_SCHEMA = {
  users: {
    required_columns: [
      'id', 'email', 'password', 'google_id', 'auth_provider', 'user_name',
      'phone', 'plan_name', 'org_role', 'org_owner_id', 'dob', 'gender',
      'language_spoken', 'country', 'state', 'city', 'pincode', 'clinic_address',
      'profile_picture', 'reset_token', 'reset_token_expires', 'created_at', 'updated_at'
    ],
    critical_columns: ['id', 'email', 'password', 'google_id', 'auth_provider']
  },
  chat_messages: {
    required_columns: [
      'id', 'conversation_id', 'message_type', 'content', 'metadata', 'created_at'
    ],
    critical_columns: ['id', 'conversation_id', 'content']
  },
  chat_conversations: {
    required_columns: [
      'id', 'user_id', 'title', 'context_data', 'is_active', 'created_at', 'updated_at'
    ],
    critical_columns: ['id', 'user_id']
  },
  appointments: {
    required_columns: [
      'id', 'therapist_id', 'client_id', 'start_time', 'end_time', 'status', 'created_at'
    ],
    critical_columns: ['id', 'therapist_id', 'client_id']
  },
  clients: {
    required_columns: [
      'id', 'therapist_id', 'first_name', 'last_name', 'email', 'phone', 'created_at'
    ],
    critical_columns: ['id', 'therapist_id']
  },
  enterprise_leads: {
    required_columns: [
      'id', 'name', 'phone', 'email', 'company_name', 'created_at'
    ],
    critical_columns: ['id', 'email']
  }
};

export async function validateSchema() {
  try {
    console.log('🔐 Validating Database Schema Integrity...');
    
    const issues = [];
    
    for (const [tableName, schema] of Object.entries(EXPECTED_SCHEMA)) {
      // Check if table exists
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [tableName]);

      if (!tableExists.rows[0].exists) {
        issues.push({
          severity: 'CRITICAL',
          table: tableName,
          issue: 'Table does not exist'
        });
        continue;
      }

      // Check required columns
      const columnsResult = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1
      `, [tableName]);

      const existingColumns = columnsResult.rows.map(r => r.column_name);

      for (const requiredCol of schema.required_columns) {
        if (!existingColumns.includes(requiredCol)) {
          const severity = schema.critical_columns.includes(requiredCol) ? 'CRITICAL' : 'WARNING';
          issues.push({
            severity,
            table: tableName,
            issue: `Missing column: ${requiredCol}`
          });
        }
      }

      // Check for unexpected columns (potential tampering)
      const unexpectedColumns = existingColumns.filter(
        col => !schema.required_columns.includes(col) && 
               !['session_id', 'sender_type', 'message', 'first_name', 'last_name', 'password_hash', 'profile_picture_url', 'is_therapist', 'bio'].includes(col)
      );

      if (unexpectedColumns.length > 0) {
        issues.push({
          severity: 'WARNING',
          table: tableName,
          issue: `Unexpected columns detected: ${unexpectedColumns.join(', ')}`
        });
      }
    }

    // Report issues
    if (issues.length === 0) {
      console.log('✅ Schema validation passed - No issues detected');
      return { valid: true, issues: [] };
    } else {
      const criticalIssues = issues.filter(i => i.severity === 'CRITICAL');
      const warnings = issues.filter(i => i.severity === 'WARNING');

      console.log(`\n⚠️ Schema Validation Issues Found:`);
      console.table(issues);

      if (criticalIssues.length > 0) {
        console.error('\n🚨 CRITICAL ISSUES - Application may not function correctly');
        return { valid: false, issues, critical: true };
      } else {
        console.warn('\n⚠️ Warnings detected - Some features may not work');
        return { valid: true, issues, warnings: true };
      }
    }
  } catch (error) {
    console.error('❌ Schema validation error:', error.message);
    return { valid: false, error: error.message };
  }
}

/**
 * Generate schema hash for integrity verification
 */
export async function generateSchemaHash() {
  try {
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

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(schemaInfo))
      .digest('hex');

    return hash;
  } catch (error) {
    console.error('Error generating schema hash:', error.message);
    return null;
  }
}

/**
 * Store schema hash for future verification
 */
export async function storeSchemaHash() {
  try {
    const hash = await generateSchemaHash();
    const hashFile = path.join(__dirname, '../.schema-hash');
    
    fs.writeFileSync(hashFile, hash, 'utf8');
    console.log('✅ Schema hash stored for integrity verification');
    
    return hash;
  } catch (error) {
    console.error('Error storing schema hash:', error.message);
    return null;
  }
}

/**
 * Verify schema hasn't changed since last check
 */
export async function verifySchemaIntegrity() {
  try {
    const hashFile = path.join(__dirname, '../.schema-hash');
    
    if (!fs.existsSync(hashFile)) {
      console.log('ℹ️ First run - storing schema hash for future verification');
      return await storeSchemaHash();
    }

    const storedHash = fs.readFileSync(hashFile, 'utf8');
    const currentHash = await generateSchemaHash();

    if (storedHash === currentHash) {
      console.log('✅ Schema integrity verified - No unauthorized changes detected');
      return true;
    } else {
      console.error('🚨 SCHEMA TAMPERING DETECTED - Schema has been modified!');
      console.error('Stored hash:', storedHash);
      console.error('Current hash:', currentHash);
      return false;
    }
  } catch (error) {
    console.error('Error verifying schema integrity:', error.message);
    return false;
  }
}

export default {
  validateSchema,
  generateSchemaHash,
  storeSchemaHash,
  verifySchemaIntegrity
};
