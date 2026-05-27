-- ============================================================================
-- MIGRATION: Fix Missing Schema Issues
-- ============================================================================

-- 1. ADD MISSING COLUMNS TO Users TABLE
-- ============================================================================
ALTER TABLE Users ADD COLUMN IF NOT EXISTS profile_slug VARCHAR(80) UNIQUE;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS profile_slug_updated_at TIMESTAMP;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS org_role VARCHAR(50) CHECK (org_role IN ('owner', 'member'));
ALTER TABLE Users ADD COLUMN IF NOT EXISTS org_owner_id INT REFERENCES Users(id) ON DELETE SET NULL;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50) DEFAULT 'free' CHECK (plan_name IN ('free', 'pro', 'enterprise'));
ALTER TABLE Users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE Users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

-- 2. CREATE Clients TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS Clients (
    id SERIAL PRIMARY KEY,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    age INT,
    occupation VARCHAR(100),
    gender VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other')),
    marital_status VARCHAR(50),
    emergency_name VARCHAR(100),
    emergency_phone VARCHAR(20),
    emergency_relation VARCHAR(50),
    manually_added BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(therapist_id, email)
);

CREATE INDEX IF NOT EXISTS idx_clients_therapist_id ON Clients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON Clients(email);

-- 3. CREATE ClientTransfers TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ClientTransfers (
    id SERIAL PRIMARY KEY,
    client_id INT NOT NULL REFERENCES Clients(id) ON DELETE CASCADE,
    from_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    to_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    transfer_options JSONB DEFAULT '{}',
    notification_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_transfers_from_therapist ON ClientTransfers(from_therapist_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_to_therapist ON ClientTransfers(to_therapist_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_status ON ClientTransfers(status);

-- 4. CREATE SessionNotes TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS SessionNotes (
    id SERIAL PRIMARY KEY,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    appointment_id INT NOT NULL REFERENCES Appointments(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_notes_therapist_id ON SessionNotes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_appointment_id ON SessionNotes(appointment_id);

-- 5. CREATE ClientActivities TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ClientActivities (
    id SERIAL PRIMARY KEY,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    client_id INT NOT NULL REFERENCES Clients(id) ON DELETE CASCADE,
    activity_type VARCHAR(100),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_activities_therapist_id ON ClientActivities(therapist_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON ClientActivities(client_id);

-- 6. CREATE Availability TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS Availability (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_availability_user_id ON Availability(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_day_of_week ON Availability(day_of_week);

-- 7. CREATE organization_therapists TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_therapists (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    therapist_user_id INT REFERENCES Users(id) ON DELETE SET NULL,
    invite_email VARCHAR(150) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
    invite_token VARCHAR(255) UNIQUE,
    invite_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organization_therapists_owner_id ON organization_therapists(owner_id);
CREATE INDEX IF NOT EXISTS idx_organization_therapists_therapist_user_id ON organization_therapists(therapist_user_id);
CREATE INDEX IF NOT EXISTS idx_organization_therapists_status ON organization_therapists(status);

-- 8. CREATE organization_details TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_details (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES Users(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    company_email VARCHAR(150),
    gst VARCHAR(50),
    street VARCHAR(255),
    city VARCHAR(100),
    pincode VARCHAR(20),
    state VARCHAR(100),
    country VARCHAR(100),
    enterprise_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organization_details_user_id ON organization_details(user_id);

-- 9. CREATE NoteTemplates TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS NoteTemplates (
    id SERIAL PRIMARY KEY,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    content TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_note_templates_therapist_id ON NoteTemplates(therapist_id);

-- 10. UPDATE Appointments TABLE (if needed)
-- ============================================================================
-- Add missing columns to Appointments table if they don't exist
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'noshow'));
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial_refund'));
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2);
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(255);
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);
ALTER TABLE Appointments ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);

-- 11. CREATE Calendars TABLE (if missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS Calendars (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(80) UNIQUE,
    description TEXT,
    duration INT DEFAULT 60, -- in minutes
    payment_enabled BOOLEAN DEFAULT false,
    prices JSONB DEFAULT '{}',
    form_data JSONB DEFAULT '{}',
    locations JSONB DEFAULT '{}',
    schedule_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON Calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_calendars_slug ON Calendars(slug);

-- 12. CREATE Appointments TABLE (if missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS Appointments (
    id SERIAL PRIMARY KEY,
    calendar_id INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    client_email VARCHAR(150) NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    client_phone VARCHAR(20),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'noshow')),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial_refund')),
    payment_amount DECIMAL(10, 2),
    cashfree_order_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    location_type VARCHAR(50),
    form_responses JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_therapist_id ON Appointments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_id ON Appointments(calendar_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_email ON Appointments(client_email);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON Appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON Appointments(status);

-- 13. UPDATE Notifications TABLE (if needed)
-- ============================================================================
ALTER TABLE Notifications ADD COLUMN IF NOT EXISTS related_id INT;

-- 14. CREATE UserIntegrations TABLE (if missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS UserIntegrations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'google',
    access_token VARCHAR(1024),
    refresh_token VARCHAR(1024),
    calendar_id VARCHAR(255),
    expiry_date BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON UserIntegrations(user_id);

-- 15. CREATE chat_conversations TABLE (if missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Conversation',
    context_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);

-- 16. CREATE chat_messages TABLE (if missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
