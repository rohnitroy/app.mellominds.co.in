-- Missing Tables Schema - Creates all missing tables referenced in routes

-- Clients table
CREATE TABLE IF NOT EXISTS Clients (
    id SERIAL PRIMARY KEY,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    age INT,
    occupation VARCHAR(100),
    gender VARCHAR(50),
    marital_status VARCHAR(50),
    emergency_name VARCHAR(255),
    emergency_phone VARCHAR(20),
    emergency_relation VARCHAR(100),
    emergency_name_encrypted VARCHAR(255),
    emergency_phone_encrypted VARCHAR(255),
    emergency_relation_encrypted VARCHAR(255),
    manually_added BOOLEAN DEFAULT false,
    clinical_profile_url TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_therapist_id ON Clients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON Clients(email);

-- ClientTransfers table
CREATE TABLE IF NOT EXISTS ClientTransfers (
    id SERIAL PRIMARY KEY,
    client_id INT NOT NULL REFERENCES Clients(id) ON DELETE CASCADE,
    from_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    to_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    reason TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_transfers_client_id ON ClientTransfers(client_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_from_therapist ON ClientTransfers(from_therapist_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_to_therapist ON ClientTransfers(to_therapist_id);
CREATE INDEX IF NOT EXISTS idx_client_transfers_status ON ClientTransfers(status);

-- ClientActivities table
CREATE TABLE IF NOT EXISTS ClientActivities (
    id SERIAL PRIMARY KEY,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    client_id INT NOT NULL REFERENCES Clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    frequency VARCHAR(50), -- daily, weekly, monthly
    reminder_interval_days INT DEFAULT 7,
    reminder_count INT DEFAULT 4,
    reminders_sent INT DEFAULT 0,
    next_reminder_at TIMESTAMP,
    notify_client BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_activities_therapist_id ON ClientActivities(therapist_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON ClientActivities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_next_reminder ON ClientActivities(next_reminder_at);

-- SessionNotes table
CREATE TABLE IF NOT EXISTS SessionNotes (
    id SERIAL PRIMARY KEY,
    appointment_id INT REFERENCES Appointments(id) ON DELETE CASCADE,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    client_id INT REFERENCES Clients(id) ON DELETE SET NULL,
    title VARCHAR(255),
    content TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_notes_appointment_id ON SessionNotes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_therapist_id ON SessionNotes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_client_id ON SessionNotes(client_id);

-- UserIntegrations table (for OAuth tokens)
CREATE TABLE IF NOT EXISTS UserIntegrations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'google', -- google, gmail, etc.
    access_token VARCHAR(1024),
    refresh_token VARCHAR(1024),
    calendar_id VARCHAR(255),
    expiry_date BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON UserIntegrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON UserIntegrations(provider);

-- Availability table
CREATE TABLE IF NOT EXISTS Availability (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL, -- 0-6 (Sunday-Saturday)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_availability_user_id ON Availability(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_day_of_week ON Availability(day_of_week);

-- NoteTemplates table
CREATE TABLE IF NOT EXISTS NoteTemplates (
    id SERIAL PRIMARY KEY,
    therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_note_templates_therapist_id ON NoteTemplates(therapist_id);

-- Add missing columns to Users table if they don't exist
ALTER TABLE Users ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB DEFAULT '{}'::jsonb;
