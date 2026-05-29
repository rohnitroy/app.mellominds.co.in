/**
 * Audit logging for sensitive data access
 * Tracks who accessed what data when
 */

import pool from '../config/database.js';

// Create audit_logs table if it doesn't exist
export const ensureAuditTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id INT,
        ip_address INET,
        user_agent TEXT,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    `);
    
    console.log('✅ Audit logs table verified');
  } catch (error) {
    console.error('⚠️ Audit table setup warning:', error.message);
  }
};

// Log an audit event
export const logAuditEvent = async ({
  userId,
  action,
  resourceType,
  resourceId = null,
  ipAddress = null,
  userAgent = null,
  details = {}
}) => {
  try {
    await pool.query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, action, resourceType, resourceId, ipAddress, userAgent, JSON.stringify(details)]);
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('Audit logging error:', error.message);
  }
};

// Middleware to extract IP and User-Agent for audit logging
export const auditMiddleware = (req, res, next) => {
  req.auditContext = {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  };
  next();
};

// Helper to log client data access
export const logClientAccess = async (req, action, clientId, details = {}) => {
  if (req.user && req.auditContext) {
    await logAuditEvent({
      userId: req.user.id,
      action,
      resourceType: 'client',
      resourceId: clientId,
      ipAddress: req.auditContext.ipAddress,
      userAgent: req.auditContext.userAgent,
      details
    });
  }
};

// Helper to log session notes access
export const logNotesAccess = async (req, action, appointmentId, details = {}) => {
  if (req.user && req.auditContext) {
    await logAuditEvent({
      userId: req.user.id,
      action,
      resourceType: 'session_notes',
      resourceId: appointmentId,
      ipAddress: req.auditContext.ipAddress,
      userAgent: req.auditContext.userAgent,
      details
    });
  }
};

// Helper to log appointment access
export const logAppointmentAccess = async (req, action, appointmentId, details = {}) => {
  if (req.user && req.auditContext) {
    await logAuditEvent({
      userId: req.user.id,
      action,
      resourceType: 'appointment',
      resourceId: appointmentId,
      ipAddress: req.auditContext.ipAddress,
      userAgent: req.auditContext.userAgent,
      details
    });
  }
};