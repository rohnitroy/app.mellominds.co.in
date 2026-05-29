-- =============================================================================
-- MelloMinds — Full Database Migration
-- =============================================================================
-- Run this on any fresh PostgreSQL / PGAdmin instance to recreate the entire
-- schema from scratch. Safe to run on an empty database.
--
-- Usage:
--   psql -U <your_user> -d <your_db> -f full_migration.sql
--
-- Or paste into PGAdmin's Query Tool and execute.
--
-- NOTE: This does NOT migrate existing data. It only creates the schema.
--       To migrate data, use pg_dump on the source DB first.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Plans
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Plans (
    id        SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL
);

-- Seed default plans (safe — ON CONFLICT DO NOTHING)
INSERT INTO Plans (plan_name) VALUES ('Free'), ('Pro')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Users (
    id               SERIAL PRIMARY KEY,
    user_name        VARCHAR(100) NOT NULL,
    password         VARCHAR(255),                          -- NULL for Google OAuth users
    email            VARCHAR(150) NOT NULL UNIQUE,
    phone            VARCHAR(20),
    plan             INT REFERENCES Plans(id) ON DELETE RESTRICT,
    dob              DATE,
    gender           VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other')),
    specialization   VARCHAR(150),
    language_spoken  VARCHAR(255),
    country          VARCHAR(100),
    state            VARCHAR(100),
    city             VARCHAR(100),
    pincode          VARCHAR(20),
    clinic_address   TEXT,
    google_id        VARCHAR(255) UNIQUE,
    auth_provider    VARCHAR(50) DEFAULT 'email' CHECK (auth_provider IN ('email', 'google')),
    profile_picture  TEXT,
    about_me         TEXT
);

-- -----------------------------------------------------------------------------
-- 3. Calendars
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Calendars (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES Users(id) ON DELETE CASCADE,
    title               VARCHAR(255) NOT NULL,
    duration            VARCHAR(50),
    type                VARCHAR(50),
    description         TEXT,
    slug                VARCHAR(255) UNIQUE,
    is_active           BOOLEAN DEFAULT true,
    form_data           JSONB DEFAULT NULL,
    payment_enabled     BOOLEAN DEFAULT false,
    payment_gateway     VARCHAR(50) DEFAULT NULL,
    prices              JSONB DEFAULT NULL,
    cancellation_policy JSONB DEFAULT NULL,
    reschedule_policy   JSONB DEFAULT NULL,
    locations           JSONB DEFAULT NULL,
    schedule_settings   JSONB DEFAULT NULL,
    max_attendees       INT DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 4. Appointments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Appointments (
    id                    SERIAL PRIMARY KEY,
    therapist_id          INT REFERENCES Users(id) ON DELETE CASCADE,
    client_id             INT REFERENCES Users(id) ON DELETE SET NULL,
    calendar_id           INT REFERENCES Calendars(id) ON DELETE SET NULL,
    title                 VARCHAR(255),
    start_time            TIMESTAMP NOT NULL,
    end_time              TIMESTAMP NOT NULL,
    appointment_date      DATE NOT NULL,
    status                VARCHAR(50) DEFAULT 'scheduled',
    google_event_id       VARCHAR(255),
    meet_link             VARCHAR(255),
    client_email          VARCHAR(150),
    client_name           VARCHAR(150),
    client_phone          VARCHAR(20),
    partner_email         VARCHAR(150),
    partner_phone         VARCHAR(20),
    partner_name          VARCHAR(150),
    payment_status        VARCHAR(50) DEFAULT 'Pending',
    payment_amount        DECIMAL(10, 2) DEFAULT 0.00,
    form_responses        JSONB DEFAULT NULL,
    location_type         VARCHAR(50) DEFAULT 'google_meet',
    cancel_token          VARCHAR(64) UNIQUE DEFAULT NULL,
    cancellation_reason   TEXT,
    no_show_reason        TEXT,
    cashfree_order_id     VARCHAR(255) DEFAULT NULL,
    cashfree_payment_link TEXT DEFAULT NULL,
    razorpay_order_id     VARCHAR(255) DEFAULT NULL,
    razorpay_payment_id   VARCHAR(255) DEFAULT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto-populate cancel_token for any rows inserted without one
-- (mirrors the server.js startup migration logic)
CREATE OR REPLACE FUNCTION set_cancel_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cancel_token IS NULL THEN
        NEW.cancel_token := md5(NEW.id::text || random()::text || clock_timestamp()::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_cancel_token ON Appointments;
CREATE TRIGGER trg_set_cancel_token
    BEFORE INSERT ON Appointments
    FOR EACH ROW EXECUTE FUNCTION set_cancel_token();

-- Add missing columns and constraints to Calendars table
ALTER TABLE Calendars
ADD COLUMN IF NOT EXISTS therapist_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS buffer_time_before INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS buffer_time_after INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived', 'deleted')),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS min_notice_minutes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS date_range_type VARCHAR(50) DEFAULT 'indefinitely',
ADD COLUMN IF NOT EXISTS date_range_value INT,
ADD COLUMN IF NOT EXISTS date_range_start DATE,
ADD COLUMN IF NOT EXISTS date_range_end DATE;

-- Create CalendarTemplates table for reusable templates
CREATE TABLE IF NOT EXISTS CalendarTemplates (
    id                  SERIAL PRIMARY KEY,
    therapist_id        INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    description         TEXT,
    template_type       VARCHAR(50) NOT NULL, -- 'one_on_one', 'group', 'workshop', 'consultation'
    form_data           JSONB DEFAULT NULL,
    prices              JSONB DEFAULT NULL,
    cancellation_policy JSONB DEFAULT NULL,
    reschedule_policy   JSONB DEFAULT NULL,
    locations           JSONB DEFAULT NULL,
    schedule_settings   JSONB DEFAULT NULL,
    is_public           BOOLEAN DEFAULT false,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_templates_therapist_id ON CalendarTemplates(therapist_id);
CREATE INDEX IF NOT EXISTS idx_calendar_templates_type ON CalendarTemplates(template_type);

-- Create CalendarVersions table for audit trail
CREATE TABLE IF NOT EXISTS CalendarVersions (
    id                  SERIAL PRIMARY KEY,
    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
    version_number      INT NOT NULL,
    title               VARCHAR(255),
    description         TEXT,
    form_data           JSONB,
    prices              JSONB,
    cancellation_policy JSONB,
    reschedule_policy   JSONB,
    locations           JSONB,
    schedule_settings   JSONB,
    changed_by          INT REFERENCES Users(id) ON DELETE SET NULL,
    change_reason       TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_versions_calendar_id ON CalendarVersions(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_versions_version ON CalendarVersions(version_number);

-- Create CalendarPermissions table for sharing
CREATE TABLE IF NOT EXISTS CalendarPermissions (
    id                  SERIAL PRIMARY KEY,
    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
    user_id             INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    permission_type     VARCHAR(50) NOT NULL CHECK (permission_type IN ('view', 'edit', 'manage')),
    granted_by          INT REFERENCES Users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(calendar_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_permissions_calendar_id ON CalendarPermissions(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_permissions_user_id ON CalendarPermissions(user_id);

-- Create CalendarMetrics table for analytics
CREATE TABLE IF NOT EXISTS CalendarMetrics (
    id                  SERIAL PRIMARY KEY,
    calendar_id         INT NOT NULL REFERENCES Calendars(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    views               INT DEFAULT 0,
    bookings            INT DEFAULT 0,
    completed_bookings  INT DEFAULT 0,
    cancelled_bookings  INT DEFAULT 0,
    revenue             DECIMAL(10, 2) DEFAULT 0.00,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(calendar_id, date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_metrics_calendar_id ON CalendarMetrics(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_metrics_date ON CalendarMetrics(date);

-- Create CalendarCustomization table for branding
CREATE TABLE IF NOT EXISTS CalendarCustomization (
    id                  SERIAL PRIMARY KEY,
    calendar_id         INT NOT NULL UNIQUE REFERENCES Calendars(id) ON DELETE CASCADE,
    primary_color       VARCHAR(7) DEFAULT '#3787F8',
    secondary_color     VARCHAR(7) DEFAULT '#ffffff',
    logo_url            TEXT,
    banner_url          TEXT,
    custom_css          TEXT,
    branding_text       TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_customization_calendar_id ON CalendarCustomization(calendar_id);

-- Add CHECK constraint to Calendars type column
ALTER TABLE Calendars
ADD CONSTRAINT check_calendar_type CHECK (type IN ('one_on_one', 'group'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON Calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_calendars_slug ON Calendars(slug);
CREATE INDEX IF NOT EXISTS idx_calendars_is_active ON Calendars(is_active);
CREATE INDEX IF NOT EXISTS idx_calendars_status ON Calendars(status);
CREATE INDEX IF NOT EXISTS idx_calendars_created_at ON Calendars(created_at);
CREATE INDEX IF NOT EXISTS idx_calendars_deleted_at ON Calendars(deleted_at);

-- Create Invoices table for storing generated invoices
CREATE TABLE IF NOT EXISTS Invoices (
    id                  SERIAL PRIMARY KEY,
    appointment_id      INT NOT NULL REFERENCES Appointments(id) ON DELETE CASCADE,
    therapist_id        INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    invoice_number      VARCHAR(50) UNIQUE NOT NULL,
    amount              DECIMAL(10, 2) NOT NULL,
    status              VARCHAR(50) DEFAULT 'draft', -- draft, sent, paid, cancelled
    pdf_url             TEXT,
    sent_at             TIMESTAMP,
    paid_at             TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_appointment_id ON Invoices(appointment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_therapist_id ON Invoices(therapist_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON Invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON Invoices(created_at);

-- -----------------------------------------------------------------------------
-- 5. Availability
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Availability (
    id           SERIAL PRIMARY KEY,
    user_id      INT REFERENCES Users(id) ON DELETE CASCADE,
    day_of_week  INT NOT NULL,          -- 0=Sun, 1=Mon, ..., 6=Sat
    start_time   TIME NOT NULL,         -- stored in IST
    end_time     TIME NOT NULL,         -- stored in IST
    is_enabled   BOOLEAN DEFAULT true,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 6. Clients
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Clients (
    id                  SERIAL PRIMARY KEY,
    therapist_id        INT REFERENCES Users(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    email               VARCHAR(150) NOT NULL,
    phone               VARCHAR(20),
    age                 INT,
    occupation          VARCHAR(100),
    gender              VARCHAR(20),
    marital_status      VARCHAR(50),
    emergency_name      VARCHAR(150),
    emergency_phone     VARCHAR(20),
    emergency_relation  VARCHAR(100),
    manually_added      BOOLEAN DEFAULT false,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (therapist_id, email)
);

-- -----------------------------------------------------------------------------
-- 7. ClientTransfers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ClientTransfers (
    id                  SERIAL PRIMARY KEY,
    client_id           INT REFERENCES Clients(id) ON DELETE CASCADE,
    from_therapist_id   INT REFERENCES Users(id) ON DELETE CASCADE,
    to_therapist_id     INT REFERENCES Users(id) ON DELETE CASCADE,
    status              VARCHAR(20) DEFAULT 'pending',   -- pending / approved / rejected
    transfer_options    JSONB DEFAULT '{}',              -- { notes: bool, activities: bool }
    notification_id     INT,                             -- FK set after Notifications insert
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 8. ClientActivities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ClientActivities (
    id                      SERIAL PRIMARY KEY,
    client_id               INT REFERENCES Clients(id) ON DELETE CASCADE,
    therapist_id            INT REFERENCES Users(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    description             TEXT,
    notify_client           BOOLEAN DEFAULT false,
    reminder_count          INT DEFAULT 0,
    reminder_interval_days  INT DEFAULT 1,
    reminders_sent          INT DEFAULT 0,
    next_reminder_at        TIMESTAMP DEFAULT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. SessionNotes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS SessionNotes (
    id              SERIAL PRIMARY KEY,
    appointment_id  INT REFERENCES Appointments(id) ON DELETE CASCADE,
    therapist_id    INT REFERENCES Users(id) ON DELETE CASCADE,
    note_content    JSONB,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 10. NoteTemplates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS NoteTemplates (
    id            SERIAL PRIMARY KEY,
    therapist_id  INT REFERENCES Users(id) ON DELETE CASCADE UNIQUE,
    fields        JSONB,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 11. UserIntegrations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS UserIntegrations (
    id            SERIAL PRIMARY KEY,
    user_id       INT REFERENCES Users(id) ON DELETE CASCADE,
    provider      VARCHAR(50) DEFAULT 'google',   -- google / cashfree
    access_token  VARCHAR(1024),
    refresh_token VARCHAR(1024),
    calendar_id   VARCHAR(255),
    expiry_date   BIGINT,
    app_id        VARCHAR(255) DEFAULT NULL,       -- Cashfree App ID
    secret_key    VARCHAR(512) DEFAULT NULL,       -- Cashfree Secret Key
    environment   VARCHAR(20) DEFAULT 'sandbox',  -- sandbox / production
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, provider)
);

-- -----------------------------------------------------------------------------
-- 12. Notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES Users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    is_read     BOOLEAN DEFAULT false,
    related_id  INT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON Notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read  ON Notifications(is_read);

-- Add FK from ClientTransfers.notification_id now that Notifications exists
ALTER TABLE ClientTransfers
    ADD COLUMN IF NOT EXISTS notification_id INT REFERENCES Notifications(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 13. enterprise_leads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise_leads (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    phone            VARCHAR(50)  NOT NULL,
    email            VARCHAR(255) NOT NULL,
    company_name     VARCHAR(255) NOT NULL,
    company_website  VARCHAR(500),
    message          TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Done. All tables created.
-- =============================================================================
