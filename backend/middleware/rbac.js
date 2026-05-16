/**
 * Enterprise-Grade Role-Based Access Control (RBAC) Middleware
 * 
 * Roles hierarchy: superadmin > owner > therapist > member
 * Each role inherits permissions from lower roles.
 * Permissions are granular and can be customized per organization.
 */

import pool from '../config/database.js';

// ─── Role Definitions ────────────────────────────────────────────────────────

export const ROLES = {
  SUPERADMIN: 'superadmin',
  OWNER: 'owner',
  THERAPIST: 'therapist',
  MEMBER: 'member',
};

// Role hierarchy (higher index = more privileges)
const ROLE_HIERARCHY = [ROLES.MEMBER, ROLES.THERAPIST, ROLES.OWNER, ROLES.SUPERADMIN];

// ─── Permission Definitions ──────────────────────────────────────────────────

export const PERMISSIONS = {
  // Client management
  CLIENTS_VIEW: 'clients:view',
  CLIENTS_CREATE: 'clients:create',
  CLIENTS_EDIT: 'clients:edit',
  CLIENTS_DELETE: 'clients:delete',
  CLIENTS_TRANSFER: 'clients:transfer',

  // Appointments / Bookings
  BOOKINGS_VIEW: 'bookings:view',
  BOOKINGS_CREATE: 'bookings:create',
  BOOKINGS_EDIT: 'bookings:edit',
  BOOKINGS_CANCEL: 'bookings:cancel',

  // Calendar
  CALENDAR_VIEW: 'calendar:view',
  CALENDAR_MANAGE: 'calendar:manage',

  // Notes
  NOTES_VIEW: 'notes:view',
  NOTES_CREATE: 'notes:create',
  NOTES_EDIT: 'notes:edit',
  NOTES_DELETE: 'notes:delete',

  // Organization / Enterprise
  ORG_VIEW: 'org:view',
  ORG_MANAGE: 'org:manage',
  ORG_INVITE: 'org:invite',
  ORG_REMOVE_MEMBER: 'org:remove_member',
  ORG_ANALYTICS: 'org:analytics',
  ORG_SETTINGS: 'org:settings',
  ORG_BILLING: 'org:billing',

  // User management
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',

  // Chat
  CHAT_VIEW: 'chat:view',
  CHAT_SEND: 'chat:send',

  // Activities
  ACTIVITIES_VIEW: 'activities:view',
  ACTIVITIES_MANAGE: 'activities:manage',

  // Payments
  PAYMENTS_VIEW: 'payments:view',
  PAYMENTS_MANAGE: 'payments:manage',

  // Profile
  PROFILE_VIEW: 'profile:view',
  PROFILE_EDIT: 'profile:edit',

  // Admin
  ADMIN_DASHBOARD: 'admin:dashboard',
  ADMIN_AUDIT_LOGS: 'admin:audit_logs',
  ADMIN_SYSTEM: 'admin:system',
};

// ─── Default Role → Permission Mapping ───────────────────────────────────────

const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.MEMBER]: [
    PERMISSIONS.CLIENTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_CREATE,
    PERMISSIONS.BOOKINGS_EDIT,
    PERMISSIONS.BOOKINGS_CANCEL,
    PERMISSIONS.CALENDAR_VIEW,
    PERMISSIONS.NOTES_VIEW,
    PERMISSIONS.NOTES_CREATE,
    PERMISSIONS.NOTES_EDIT,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.CHAT_SEND,
    PERMISSIONS.ACTIVITIES_VIEW,
    PERMISSIONS.ACTIVITIES_MANAGE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PROFILE_VIEW,
    PERMISSIONS.PROFILE_EDIT,
  ],

  [ROLES.THERAPIST]: [
    // Inherits all member permissions plus:
    PERMISSIONS.CLIENTS_CREATE,
    PERMISSIONS.CLIENTS_EDIT,
    PERMISSIONS.CLIENTS_DELETE,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.NOTES_DELETE,
    PERMISSIONS.PAYMENTS_MANAGE,
  ],

  [ROLES.OWNER]: [
    // Inherits all therapist permissions plus:
    PERMISSIONS.CLIENTS_TRANSFER,
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_INVITE,
    PERMISSIONS.ORG_REMOVE_MEMBER,
    PERMISSIONS.ORG_ANALYTICS,
    PERMISSIONS.ORG_SETTINGS,
    PERMISSIONS.ORG_BILLING,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ADMIN_DASHBOARD,
    PERMISSIONS.ADMIN_AUDIT_LOGS,
  ],

  [ROLES.SUPERADMIN]: [
    // All permissions
    PERMISSIONS.ADMIN_SYSTEM,
  ],
};

// ─── Permission Resolution ───────────────────────────────────────────────────

/**
 * Get the effective role for a user based on their org_role and plan.
 */
export function resolveUserRole(user) {
  if (user.org_role === 'superadmin') return ROLES.SUPERADMIN;
  if (user.org_role === 'owner' && user.plan_name === 'enterprise') return ROLES.OWNER;
  if (user.org_role === 'member' && user.plan_name === 'enterprise') return ROLES.MEMBER;
  // Default: individual therapist
  return ROLES.THERAPIST;
}

/**
 * Get all permissions for a role (including inherited from lower roles).
 */
export function getPermissionsForRole(role) {
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  if (roleIndex === -1) return [];

  const permissions = new Set();

  // Collect permissions from this role and all lower roles
  for (let i = 0; i <= roleIndex; i++) {
    const roleName = ROLE_HIERARCHY[i];
    const rolePerms = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    rolePerms.forEach(p => permissions.add(p));
  }

  // Superadmin gets everything
  if (role === ROLES.SUPERADMIN) {
    Object.values(PERMISSIONS).forEach(p => permissions.add(p));
  }

  return [...permissions];
}

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(role, permission) {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Check if roleA is equal to or higher than roleB in the hierarchy.
 */
export function isRoleAtLeast(roleA, roleB) {
  return ROLE_HIERARCHY.indexOf(roleA) >= ROLE_HIERARCHY.indexOf(roleB);
}

// ─── Middleware Factories ────────────────────────────────────────────────────

/**
 * Middleware: Require user to be authenticated and attach RBAC context.
 * This replaces the basic isAuthenticated middleware with RBAC-aware version.
 */
export function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Attach RBAC context to request
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

  next();
}

/**
 * Middleware: Require a minimum role level.
 * Usage: requireRole(ROLES.OWNER)
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    // Ensure requireAuth ran first
    if (!req.rbac) {
      return res.status(500).json({ error: 'RBAC context not initialized. Use requireAuth first.' });
    }

    if (!req.rbac.isAtLeast(minRole)) {
      return res.status(403).json({
        error: 'Insufficient privileges.',
        required: minRole,
        current: req.rbac.role,
      });
    }

    next();
  };
}

/**
 * Middleware: Require specific permission(s).
 * Usage: requirePermission(PERMISSIONS.CLIENTS_DELETE)
 *        requirePermission([PERMISSIONS.ORG_MANAGE, PERMISSIONS.ORG_INVITE], 'any')
 */
export function requirePermission(permissions, mode = 'all') {
  const permArray = Array.isArray(permissions) ? permissions : [permissions];

  return (req, res, next) => {
    if (!req.rbac) {
      return res.status(500).json({ error: 'RBAC context not initialized. Use requireAuth first.' });
    }

    const hasAccess = mode === 'any'
      ? req.rbac.hasAnyPermission(permArray)
      : req.rbac.hasAllPermissions(permArray);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action.',
        required: permArray,
      });
    }

    next();
  };
}

/**
 * Middleware: Require ownership of a resource OR a minimum role.
 * Useful for "you can edit your own data, or an admin can edit anyone's".
 * Usage: requireOwnershipOrRole('therapist_id', ROLES.OWNER)
 */
export function requireOwnershipOrRole(ownerField, minRole) {
  return async (req, res, next) => {
    if (!req.rbac) {
      return res.status(500).json({ error: 'RBAC context not initialized.' });
    }

    // If user has the minimum role, allow access
    if (req.rbac.isAtLeast(minRole)) {
      return next();
    }

    // Otherwise check ownership
    const resourceOwnerId = req.body[ownerField] || req.params[ownerField];
    if (resourceOwnerId && String(resourceOwnerId) === String(req.user.id)) {
      return next();
    }

    return res.status(403).json({
      error: 'Access denied. You can only access your own resources.',
    });
  };
}

/**
 * Middleware: Scope data access to the user's organization.
 * Attaches org context (owner ID, member IDs) to the request.
 */
export async function requireOrgContext(req, res, next) {
  if (!req.rbac) {
    return res.status(500).json({ error: 'RBAC context not initialized.' });
  }

  if (!req.rbac.isAtLeast(ROLES.MEMBER)) {
    return res.status(403).json({ error: 'Organization access requires enterprise plan.' });
  }

  try {
    const userId = req.user.id;
    const orgOwnerId = req.user.org_role === 'owner' ? userId : req.user.org_owner_id;

    if (!orgOwnerId) {
      return res.status(403).json({ error: 'No organization context found.' });
    }

    // Get all active member IDs in this org
    const membersRes = await pool.query(
      `SELECT therapist_user_id FROM organization_therapists 
       WHERE owner_id = $1 AND status = 'active' AND therapist_user_id IS NOT NULL`,
      [orgOwnerId]
    );

    const memberIds = membersRes.rows.map(r => r.therapist_user_id);
    const allOrgUserIds = [orgOwnerId, ...memberIds];

    req.orgContext = {
      ownerId: orgOwnerId,
      memberIds,
      allUserIds: allOrgUserIds,
      isOwner: req.user.org_role === 'owner',
    };

    next();
  } catch (error) {
    console.error('Org context resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve organization context.' });
  }
}
