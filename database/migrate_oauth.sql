-- Migration script to add Google OAuth support to existing Users table
-- Run this if you already have the Users table created

\c mello_db mello_admin

-- Make password nullable for OAuth users
ALTER TABLE Users ALTER COLUMN password DROP NOT NULL;

-- Add Google OAuth fields
ALTER TABLE Users 
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add constraint for auth_provider
ALTER TABLE Users 
  ADD CONSTRAINT check_auth_provider 
  CHECK (auth_provider IN ('email', 'google'));
