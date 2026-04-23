-- Migration: Add organization_therapists table for enterprise plan users
-- This table allows enterprise users to manage a team of therapists under their account
-- Auto-applied on server startup via ensureOrganizationTherapistsSchema()

CREATE TABLE IF NOT EXISTS organization_therapists (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    therapist_user_id INT REFERENCES Users(id) ON DELETE SET NULL,
    invite_email VARCHAR(254) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    invite_token VARCHAR(64),
    invite_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_id, invite_email)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_therapists_owner ON organization_therapists(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_therapists_token ON organization_therapists(invite_token);

-- Notes:
-- - owner_id: The enterprise user who owns the organization
-- - therapist_user_id: NULL if invite is pending, set when user accepts/exists
-- - invite_email: Email address invited (unique per owner)
-- - status: 'pending' (invite sent) or 'active' (therapist joined)
-- - invite_token: Used for signup flow (optional, for future use)
-- - invite_expires_at: Invite expiry (7 days from creation)
