import pool from '../config/database.js';
import crypto from 'crypto';

/**
 * Data Integrity Monitor - Detects unauthorized data modifications
 */

export async function calculateTableChecksum(tableName) {
  try {
    const result = await pool.query(`
      SELECT 
        md5(string_agg(md5(t::text), '' ORDER BY md5(t::text))) as checksum
      FROM (
        SELECT * FROM ${tableName} ORDER BY id
      ) t
    `);

    return result.rows[0].checksum;
  } catch (error) {
    console.error(`Error calculating checksum for ${tableName}:`, error.message);
    return null;
  }
}

export async function monitorDataIntegrity() {
  try {
    console.log('🔍 Monitoring Data Integrity...');

    const criticalTables = ['users', 'appointments', 'clients', 'organization_therapists'];
    const checksums = {};

    for (const table of criticalTables) {
      const checksum = await calculateTableChecksum(table);
      checksums[table] = checksum;
      console.log(`  ✅ ${table}: ${checksum?.substring(0, 16)}...`);
    }

    return checksums;
  } catch (error) {
    console.error('Error monitoring data integrity:', error.message);
    return null;
  }
}

/**
 * Audit trail for sensitive operations
 */
export async function logAuditTrail(userId, action, tableName, recordId, changes) {
  try {
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, changes, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [userId, action, tableName, recordId, JSON.stringify(changes)]);
  } catch (error) {
    console.error('Error logging audit trail:', error.message);
  }
}

/**
 * Detect suspicious database activities
 */
export async function detectSuspiciousActivity() {
  try {
    console.log('🔐 Checking for Suspicious Activities...');

    // Check for bulk deletes
    const deleteCheck = await pool.query(`
      SELECT COUNT(*) as delete_count
      FROM audit_logs
      WHERE action = 'DELETE' AND created_at > NOW() - INTERVAL '1 hour'
    `);

    if (deleteCheck.rows[0].delete_count > 10) {
      console.warn('⚠️ WARNING: Unusual number of deletions detected');
      return { suspicious: true, reason: 'Bulk deletions' };
    }

    // Check for unauthorized schema changes
    const schemaCheck = await pool.query(`
      SELECT COUNT(*) as schema_changes
      FROM audit_logs
      WHERE action LIKE '%ALTER%' AND created_at > NOW() - INTERVAL '1 hour'
    `);

    if (schemaCheck.rows[0].schema_changes > 0) {
      console.warn('⚠️ WARNING: Schema modifications detected');
      return { suspicious: true, reason: 'Schema changes' };
    }

    console.log('✅ No suspicious activities detected');
    return { suspicious: false };
  } catch (error) {
    console.error('Error detecting suspicious activity:', error.message);
    return { error: error.message };
  }
}

export default {
  calculateTableChecksum,
  monitorDataIntegrity,
  logAuditTrail,
  detectSuspiciousActivity
};
