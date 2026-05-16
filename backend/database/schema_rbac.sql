-- ═══════════════════════════════════════════════════════════════════════════════
-- Enterprise RBAC & Secure Session Schema
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add login security columns to Users table
ALTER TABLE Users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Custom roles table (for org-specific role customization)
CREATE TABLE IF NOT EXISTS rbac_roles (
  id SERIAL PRIMARY KEY,
  org_owner_id INT REFERENCES Users(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100),
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_owner_id, role_name)
);

-- 3. User-role assignments (for custom roles beyond the default org_role)
CREATE TABLE IF NOT EXISTS rbac_user_roles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  granted_by INT REFERENCES Users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (user_id, role_id)
);

-- 4. Audit log for RBAC changes
CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id SERIAL PRIMARY KEY,
  actor_id INT REFERENCES Users(id) ON DELETE SET NULL,
  target_user_id INT REFERENCES Users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rbac_roles_org ON rbac_roles(org_owner_id);
CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_user ON rbac_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_role ON rbac_user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_actor ON rbac_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_target ON rbac_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_created ON rbac_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON Users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_org_owner ON Users(org_owner_id) WHERE org_owner_id IS NOT NULL;

-- 6. Insert default system roles
INSERT INTO rbac_roles (org_owner_id, role_name, display_name, description, permissions, is_system)
VALUES 
  (NULL, 'superadmin', 'Super Admin', 'Full system access', '"*"', true),
  (NULL, 'owner', 'Organization Owner', 'Full organization management', '["clients:*","bookings:*","calendar:*","notes:*","org:*","users:*","chat:*","activities:*","payments:*","profile:*","admin:dashboard","admin:audit_logs"]', true),
  (NULL, 'therapist', 'Therapist', 'Individual practitioner', '["clients:view","clients:create","clients:edit","clients:delete","bookings:*","calendar:*","notes:*","chat:*","activities:*","payments:*","profile:*"]', true),
  (NULL, 'member', 'Organization Member', 'Organization team member', '["clients:view","bookings:view","bookings:create","bookings:edit","bookings:cancel","calendar:view","notes:view","notes:create","notes:edit","chat:*","activities:*","payments:view","profile:*"]', true)
ON CONFLICT DO NOTHING;
