import pool from '../config/database.js';
import { resolveUserRole, getPermissionsForRole, isRoleAtLeast } from './rbac.js';

/**
 * Middleware to check if user is authenticated.
 * Also attaches RBAC context to the request.
 */
export const isAuthenticated = async (req, res, next) => {
  if (req.isAuthenticated()) {
    // Set the current user ID for Row Level Security
    try {
      await pool.query('SET app.current_user_id = $1', [req.user.id]);
    } catch (error) {
      console.error('Failed to set RLS user context:', error);
      // Don't fail the request if RLS context setting fails
    }

    // Attach RBAC context
    const role = resolveUserRole(req.user);
    const permissions = getPermissionsForRole(role);

    req.rbac = {
      role,
      permissions,
      hasPermission: (perm) => permissions.includes(perm),
      hasAnyPermission: (perms) => perms.some(p => permissions.includes(p)),
      hasAllPermissions: (perms) => perms.every(p => permissions.includes(p)),
      isAtLeast: (minRole) => isRoleAtLeast(role, minRole),
    };

    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login.' });
};
