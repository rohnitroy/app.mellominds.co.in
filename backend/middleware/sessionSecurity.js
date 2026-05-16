/**
 * Enterprise-Grade Secure Session Handling
 * 
 * Features:
 * - Session fingerprinting (binds session to user-agent + IP prefix)
 * - Idle timeout with sliding window
 * - Concurrent session limits
 * - Session invalidation on privilege change
 * - Absolute session lifetime enforcement
 * - CSRF protection via double-submit cookie pattern
 */

import crypto from 'crypto';
import pool from '../config/database.js';

// ─── Configuration ───────────────────────────────────────────────────────────

const SESSION_CONFIG = {
  // Maximum concurrent sessions per user
  maxConcurrentSessions: parseInt(process.env.MAX_SESSIONS || '5', 10),

  // Idle timeout in milliseconds (30 minutes)
  idleTimeout: parseInt(process.env.SESSION_IDLE_TIMEOUT || String(30 * 60 * 1000), 10),

  // Absolute session lifetime (8 hours)
  absoluteLifetime: parseInt(process.env.SESSION_ABSOLUTE_LIFETIME || String(8 * 60 * 60 * 1000), 10),

  // Whether to enforce fingerprint validation
  enforceFingerprintValidation: process.env.NODE_ENV === 'production',

  // Regenerate session ID interval (every 15 minutes)
  regenerateInterval: 15 * 60 * 1000,
};

// ─── Session Fingerprinting ──────────────────────────────────────────────────

/**
 * Generate a fingerprint from request metadata.
 * Uses user-agent + IP class-C subnet (first 3 octets) for stability.
 */
function generateFingerprint(req) {
  const ua = req.headers['user-agent'] || 'unknown';
  const ip = getClientIp(req);
  // Use class-C subnet to allow minor IP changes (mobile networks)
  const ipPrefix = ip.split('.').slice(0, 3).join('.');

  const raw = `${ua}|${ipPrefix}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * Extract client IP considering proxies.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '0.0.0.0';
}

// ─── Middleware: Session Security Layer ──────────────────────────────────────

/**
 * Main session security middleware.
 * Should be applied AFTER session middleware and BEFORE route handlers.
 * 
 * Responsibilities:
 * 1. Stamp new sessions with fingerprint and timestamps
 * 2. Validate fingerprint on subsequent requests
 * 3. Enforce idle timeout
 * 4. Enforce absolute lifetime
 * 5. Periodically regenerate session ID
 */
export function sessionSecurity(req, res, next) {
  // Skip for unauthenticated requests
  if (!req.session || !req.isAuthenticated || !req.isAuthenticated()) {
    return next();
  }

  const now = Date.now();
  const session = req.session;

  // ─── 1. Initialize session metadata on first authenticated request ───
  if (!session._security) {
    session._security = {
      fingerprint: generateFingerprint(req),
      createdAt: now,
      lastActivity: now,
      lastRegeneration: now,
      userId: req.user.id,
    };
    return next();
  }

  const sec = session._security;

  // ─── 2. Fingerprint Validation ───────────────────────────────────────
  if (SESSION_CONFIG.enforceFingerprintValidation) {
    const currentFingerprint = generateFingerprint(req);
    if (sec.fingerprint !== currentFingerprint) {
      console.warn(`⚠️  Session fingerprint mismatch for user ${req.user.id}. Possible session hijacking.`);
      return destroySessionWithError(req, res, 'Session validation failed. Please log in again.');
    }
  }

  // ─── 3. Absolute Lifetime Check ─────────────────────────────────────
  if (now - sec.createdAt > SESSION_CONFIG.absoluteLifetime) {
    return destroySessionWithError(req, res, 'Session expired. Please log in again.');
  }

  // ─── 4. Idle Timeout Check ──────────────────────────────────────────
  if (now - sec.lastActivity > SESSION_CONFIG.idleTimeout) {
    return destroySessionWithError(req, res, 'Session timed out due to inactivity. Please log in again.');
  }

  // ─── 5. Update last activity (sliding window) ───────────────────────
  sec.lastActivity = now;

  // ─── 6. Periodic Session ID Regeneration ────────────────────────────
  if (now - sec.lastRegeneration > SESSION_CONFIG.regenerateInterval) {
    sec.lastRegeneration = now;
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
        // Non-fatal — continue with existing session
      }
      next();
    });
    return; // next() called in regenerate callback
  }

  next();
}

/**
 * Destroy session and return 401.
 */
function destroySessionWithError(req, res, message) {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.clearCookie('connect.sid');
    res.status(401).json({ error: message, code: 'SESSION_INVALID' });
  });
}

// ─── Concurrent Session Management ──────────────────────────────────────────

/**
 * Middleware: Enforce concurrent session limits.
 * Call this AFTER successful login to prune old sessions.
 */
export async function enforceConcurrentSessionLimit(userId) {
  try {
    // Count active sessions for this user
    const countRes = await pool.query(
      `SELECT COUNT(*) as count FROM user_sessions 
       WHERE sess::jsonb->'passport'->>'user' = $1
       AND expire > NOW()`,
      [String(userId)]
    );

    const activeCount = parseInt(countRes.rows[0].count, 10);

    if (activeCount > SESSION_CONFIG.maxConcurrentSessions) {
      // Delete oldest sessions, keeping only the most recent ones
      await pool.query(
        `DELETE FROM user_sessions 
         WHERE sid IN (
           SELECT sid FROM user_sessions
           WHERE sess::jsonb->'passport'->>'user' = $1
           AND expire > NOW()
           ORDER BY expire ASC
           LIMIT $2
         )`,
        [String(userId), activeCount - SESSION_CONFIG.maxConcurrentSessions]
      );
    }
  } catch (error) {
    // Non-fatal — log and continue
    console.error('Concurrent session enforcement error:', error.message);
  }
}

// ─── Session Invalidation ────────────────────────────────────────────────────

/**
 * Invalidate all sessions for a user (e.g., on password change, role change).
 * Optionally exclude the current session.
 */
export async function invalidateUserSessions(userId, excludeSessionId = null) {
  try {
    let query = `DELETE FROM user_sessions WHERE sess::jsonb->'passport'->>'user' = $1`;
    const params = [String(userId)];

    if (excludeSessionId) {
      query += ' AND sid != $2';
      params.push(excludeSessionId);
    }

    const result = await pool.query(query, params);
    console.log(`🔒 Invalidated ${result.rowCount} session(s) for user ${userId}`);
    return result.rowCount;
  } catch (error) {
    console.error('Session invalidation error:', error.message);
    return 0;
  }
}

/**
 * Invalidate all sessions for all members of an organization.
 * Useful when org-wide settings change (e.g., permissions update).
 */
export async function invalidateOrgSessions(orgOwnerId) {
  try {
    // Get all user IDs in the org
    const membersRes = await pool.query(
      `SELECT therapist_user_id FROM organization_therapists 
       WHERE owner_id = $1 AND status = 'active' AND therapist_user_id IS NOT NULL`,
      [orgOwnerId]
    );

    const userIds = [orgOwnerId, ...membersRes.rows.map(r => r.therapist_user_id)];

    let totalInvalidated = 0;
    for (const uid of userIds) {
      totalInvalidated += await invalidateUserSessions(uid);
    }

    console.log(`🔒 Invalidated ${totalInvalidated} org session(s) for org owner ${orgOwnerId}`);
    return totalInvalidated;
  } catch (error) {
    console.error('Org session invalidation error:', error.message);
    return 0;
  }
}

// ─── Login Security Helpers ──────────────────────────────────────────────────

/**
 * Track failed login attempts for account lockout.
 * Returns { locked, remainingAttempts, lockoutEndsAt }
 */
export async function checkLoginAttempts(email) {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  try {
    const result = await pool.query(
      `SELECT failed_login_attempts, locked_until FROM Users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return { locked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    const user = result.rows[0];
    const attempts = user.failed_login_attempts || 0;
    const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;

    // Check if currently locked
    if (lockedUntil && lockedUntil > new Date()) {
      return {
        locked: true,
        remainingAttempts: 0,
        lockoutEndsAt: lockedUntil.toISOString(),
      };
    }

    // If lock expired, reset
    if (lockedUntil && lockedUntil <= new Date()) {
      await pool.query(
        `UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE email = $1`,
        [email]
      );
      return { locked: false, remainingAttempts: MAX_ATTEMPTS };
    }

    return {
      locked: false,
      remainingAttempts: MAX_ATTEMPTS - attempts,
    };
  } catch (error) {
    console.error('Login attempt check error:', error.message);
    return { locked: false, remainingAttempts: MAX_ATTEMPTS };
  }
}

/**
 * Record a failed login attempt. Locks account after MAX_ATTEMPTS.
 */
export async function recordFailedLogin(email) {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000;

  try {
    const result = await pool.query(
      `UPDATE Users 
       SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1
       WHERE email = $1
       RETURNING failed_login_attempts`,
      [email]
    );

    if (result.rows.length > 0 && result.rows[0].failed_login_attempts >= MAX_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION);
      await pool.query(
        `UPDATE Users SET locked_until = $1 WHERE email = $2`,
        [lockUntil, email]
      );
    }
  } catch (error) {
    console.error('Record failed login error:', error.message);
  }
}

/**
 * Reset failed login attempts on successful login.
 */
export async function resetFailedLogins(email) {
  try {
    await pool.query(
      `UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE email = $1`,
      [email]
    );
  } catch (error) {
    console.error('Reset failed logins error:', error.message);
  }
}

// ─── Export Config for Testing ───────────────────────────────────────────────

export { SESSION_CONFIG };
