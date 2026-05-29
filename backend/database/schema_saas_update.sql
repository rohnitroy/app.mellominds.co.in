-- Add SaaS columns to Users table
-- SKIPPED: Current user db_admin cannot alter table owned by mello_admin
-- ALTER TABLE Users 
-- ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'client' CHECK (role IN ('superadmin', 'therapist', 'client')),
-- ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT false,
-- ADD COLUMN IF NOT EXISTS google_access_token VARCHAR(255),
-- ADD COLUMN IF NOT EXISTS google_refresh_token VARCHAR(255),
-- ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255);

-- Create Calendars table
CREATE TABLE IF NOT EXISTS Calendars (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    duration VARCHAR(50), -- e.g. "50 m"
    type VARCHAR(50), -- e.g. "one_on_one", "group", "couples"
    description TEXT,
    slug VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Appointments table
CREATE TABLE IF NOT EXISTS Appointments (
    id SERIAL PRIMARY KEY,
    therapist_id INT REFERENCES Users(id) ON DELETE CASCADE,
    client_id INT REFERENCES Users(id) ON DELETE SET NULL, -- Can be null if manual entry
    calendar_id INT REFERENCES Calendars(id) ON DELETE SET NULL,
    title VARCHAR(255),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, cancelled, completed
    google_event_id VARCHAR(255),
    meet_link VARCHAR(255),
    client_email VARCHAR(150), -- In case client_id is null
    client_name VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
