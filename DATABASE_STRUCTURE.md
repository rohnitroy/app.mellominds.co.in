# MelloMinds Database Structure

## Database: `mello_db`
**Database User:** `postgres` (Production: 72.60.103.151:5433)

---

## Tables Overview

1. **Plans** - Subscription plans
2. **Users** - Therapist/user accounts
3. **Calendars** - Booking calendar resources
4. **Appointments** - Scheduled sessions/bookings
5. **Clients** - Client information
6. **ClientActivities** - Client activity tracking
7. **SessionNotes** - Appointment notes
8. **Availability** - Therapist weekly availability
9. **UserIntegrations** - OAuth tokens and integrations

---

## Detailed Schema

### 1. Plans
Stores subscription plan information.

```sql
CREATE TABLE Plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL
);
```

**Columns:**
- `id` - Primary key
- `plan_name` - Name of the plan (e.g., "Free", "Pro", "Enterprise")

---

### 2. Users
Stores therapist/user account information.

```sql
CREATE TABLE Users (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    password VARCHAR(255), -- Nullable for OAuth users
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    plan INT,
    dob DATE,
    gender VARCHAR(20) CHECK (gender IN ('Male', 'Female', 'Other')),
    specialization VARCHAR(150),
    language_spoken VARCHAR(255),
    country VARCHAR(100),
    state VARCHAR(100),
    city VARCHAR(100),
    pincode VARCHAR(20),
    clinic_address TEXT,
    google_id VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(50) DEFAULT 'email' CHECK (auth_provider IN ('email', 'google')),
    profile_picture TEXT,
    FOREIGN KEY (plan) REFERENCES Plans(id) ON DELETE RESTRICT
);
```

**Columns:**
- `id` - Primary key
- `user_name` - Full name of the user
- `password` - Hashed password (nullable for OAuth users)
- `email` - Unique email address
- `phone` - Phone number
- `plan` - Foreign key to Plans table
- `dob` - Date of birth
- `gender` - Gender (Male, Female, Other)
- `specialization` - Professional specialization
- `language_spoken` - Languages spoken
- `country` - Country
- `state` - State/Province
- `city` - City
- `pincode` - Postal/ZIP code
- `clinic_address` - Clinic/office address
- `google_id` - Google OAuth ID (unique)
- `auth_provider` - Authentication method (email or google)
- `profile_picture` - Profile picture URL

**Indexes:**
- Unique on `email`
- Unique on `google_id`

---

### 3. Calendars
Stores booking calendar resources created by therapists.

```sql
CREATE TABLE Calendars (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    duration VARCHAR(50),
    type VARCHAR(50),
    description TEXT,
    slug VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Primary key
- `user_id` - Foreign key to Users (therapist)
- `title` - Calendar title (e.g., "Initial Consultation")
- `duration` - Session duration (e.g., "50 m", "60 m")
- `type` - Session type (e.g., "one_on_one", "group", "couples")
- `description` - Calendar description
- `slug` - Unique URL slug for public booking
- `is_active` - Whether calendar is active
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- Unique on `slug`
- Foreign key on `user_id`

---

### 4. Appointments
Stores scheduled appointments/sessions.

```sql
CREATE TABLE Appointments (
    id SERIAL PRIMARY KEY,
    therapist_id INT REFERENCES Users(id) ON DELETE CASCADE,
    client_id INT REFERENCES Users(id) ON DELETE SET NULL,
    calendar_id INT REFERENCES Calendars(id) ON DELETE SET NULL,
    title VARCHAR(255),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    google_event_id VARCHAR(255),
    meet_link VARCHAR(255),
    client_email VARCHAR(150),
    client_name VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Primary key
- `therapist_id` - Foreign key to Users (therapist)
- `client_id` - Foreign key to Users (client, nullable)
- `calendar_id` - Foreign key to Calendars
- `title` - Appointment title
- `start_time` - Start date/time
- `end_time` - End date/time
- `status` - Status (scheduled, cancelled, completed, no_show)
- `google_event_id` - Google Calendar event ID
- `meet_link` - Google Meet link
- `client_email` - Client email (for non-registered clients)
- `client_name` - Client name (for non-registered clients)
- `created_at` - Creation timestamp

**Indexes:**
- Foreign key on `therapist_id`
- Foreign key on `client_id`
- Foreign key on `calendar_id`

---

### 5. Clients
Stores client information per therapist.

```sql
CREATE TABLE Clients (
    id SERIAL PRIMARY KEY,
    therapist_id INTEGER REFERENCES Users(id),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    emergency_name VARCHAR(255),
    emergency_phone VARCHAR(50),
    emergency_relation VARCHAR(100),
    age VARCHAR(10),
    occupation VARCHAR(100),
    gender VARCHAR(20),
    marital_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(therapist_id, email)
);
```

**Columns:**
- `id` - Primary key
- `therapist_id` - Foreign key to Users (therapist)
- `email` - Client email
- `phone` - Client phone number
- `emergency_name` - Emergency contact name
- `emergency_phone` - Emergency contact phone
- `emergency_relation` - Emergency contact relation
- `age` - Client age
- `occupation` - Client occupation
- `gender` - Client gender
- `marital_status` - Marital status
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- Unique on `(therapist_id, email)` - One client per therapist per email
- Foreign key on `therapist_id`

---

### 6. ClientActivities
Stores client activity tracking.

```sql
CREATE TABLE ClientActivities (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES Clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_visible BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Primary key
- `client_id` - Foreign key to Clients
- `name` - Activity name
- `description` - Activity description
- `is_visible` - Visibility flag
- `created_at` - Creation timestamp

**Indexes:**
- Foreign key on `client_id`

---

### 7. SessionNotes
Stores session notes for appointments.

```sql
CREATE TABLE SessionNotes (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES Appointments(id) ON DELETE CASCADE,
    therapist_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
    note_content JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Primary key
- `appointment_id` - Foreign key to Appointments
- `therapist_id` - Foreign key to Users (therapist)
- `note_content` - Notes stored as JSONB array
- `created_at` - Creation timestamp

**Indexes:**
- Foreign key on `appointment_id`
- Foreign key on `therapist_id`

---

### 8. Availability
Stores therapist weekly availability schedule.

```sql
CREATE TABLE Availability (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(id),
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, day_of_week, start_time, end_time)
);

CREATE INDEX idx_availability_user ON Availability(user_id);
```

**Columns:**
- `id` - Primary key
- `user_id` - Foreign key to Users (therapist)
- `day_of_week` - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
- `start_time` - Start time
- `end_time` - End time
- `is_enabled` - Whether slot is enabled
- `created_at` - Creation timestamp

**Indexes:**
- Unique on `(user_id, day_of_week, start_time, end_time)`
- Index on `user_id`

---

### 9. UserIntegrations
Stores OAuth tokens and integration credentials.

```sql
CREATE TABLE UserIntegrations (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'google',
    access_token VARCHAR(1024),
    refresh_token VARCHAR(1024),
    calendar_id VARCHAR(255),
    expiry_date BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);
```

**Columns:**
- `id` - Primary key
- `user_id` - Foreign key to Users
- `provider` - Integration provider (e.g., "google")
- `access_token` - OAuth access token
- `refresh_token` - OAuth refresh token
- `calendar_id` - Google Calendar ID
- `expiry_date` - Token expiry timestamp
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- Unique on `(user_id, provider)` - One integration per provider per user
- Foreign key on `user_id`

---

## Relationships

```
Plans (1) ──< (N) Users
Users (1) ──< (N) Calendars
Users (1) ──< (N) Appointments (as therapist)
Users (1) ──< (N) Appointments (as client)
Users (1) ──< (N) Clients (as therapist)
Users (1) ──< (N) SessionNotes
Users (1) ──< (N) Availability
Users (1) ──< (N) UserIntegrations
Calendars (1) ──< (N) Appointments
Appointments (1) ──< (N) SessionNotes
Clients (1) ──< (N) ClientActivities
```

---

## Database Constraints

### Foreign Key Constraints
- All foreign keys use appropriate ON DELETE actions:
  - `CASCADE` - Delete related records
  - `SET NULL` - Set to NULL on parent delete
  - `RESTRICT` - Prevent deletion if references exist

### Check Constraints
- `Users.gender` - Must be 'Male', 'Female', or 'Other'
- `Users.auth_provider` - Must be 'email' or 'google'

### Unique Constraints
- `Users.email` - Unique across all users
- `Users.google_id` - Unique Google OAuth ID
- `Calendars.slug` - Unique booking URL slug
- `Clients(therapist_id, email)` - One client per therapist per email
- `Availability(user_id, day_of_week, start_time, end_time)` - No duplicate time slots
- `UserIntegrations(user_id, provider)` - One integration per provider per user

---

## Indexes

Performance indexes created:
- `idx_availability_user` on `Availability(user_id)`
- Automatic indexes on all PRIMARY KEY columns
- Automatic indexes on all UNIQUE constraints
- Automatic indexes on all FOREIGN KEY columns

---

## Data Types

- **SERIAL** - Auto-incrementing integer (PostgreSQL)
- **VARCHAR(n)** - Variable character string with max length
- **TEXT** - Unlimited text
- **INT/INTEGER** - 4-byte integer
- **BIGINT** - 8-byte integer
- **DATE** - Date (no time)
- **TIME** - Time (no date)
- **TIMESTAMP** - Date and time
- **BOOLEAN** - True/false
- **JSONB** - Binary JSON (efficient storage and querying)

---

## Migration Scripts

Located in:
- `database/create_tables.sql` - Initial schema
- `database/migrate_oauth.sql` - OAuth migration
- `backend/database/schema_saas_update.sql` - SaaS features
- `backend/database/schema_integrations.sql` - Integrations
- `backend/scripts/init_availability_table.js` - Availability table
- `backend/scripts/update_schema_clients.js` - Clients tables
- `backend/scripts/update_schema_notes.js` - Session notes

---

## Connection Details

**Production Database:**
- Host: 72.60.103.151
- Port: 5433
- Database: mello_db
- User: postgres
- Password: aikimkc

**Local Development:**
- Host: localhost
- Port: 5432
- Database: mello_db
- User: mello_admin


---

## Sample Data Examples

### Plans Table
```json
{
  "id": 1,
  "plan_name": "Free"
}
```

### Users Table
```json
{
  "id": 3,
  "user_name": "Rohnit Roy",
  "email": "rohnit@example.com",
  "phone": "9876543210",
  "plan": 1,
  "dob": "1990-05-15",
  "gender": "Male",
  "specialization": "Clinical Psychologist",
  "language_spoken": "English, Hindi, Odia",
  "country": "INDIA",
  "state": "Odisha",
  "city": "Bhubaneswar",
  "pincode": "751001",
  "clinic_address": "123 Main Street, Bhubaneswar",
  "google_id": "google_123456789",
  "auth_provider": "google",
  "profile_picture": "https://lh3.googleusercontent.com/a/..."
}
```

### UserIntegrations Table
```json
{
  "id": 1,
  "user_id": 3,
  "provider": "google",
  "access_token": "ya29.a0AfH6SMB...",
  "refresh_token": "1//0gXXXXXXXXXXXX",
  "calendar_id": "primary",
  "expiry_date": 1709654400000,
  "created_at": "2024-03-01T10:00:00Z",
  "updated_at": "2024-03-01T10:00:00Z"
}
```

### Calendars Table
```json
{
  "id": 1,
  "user_id": 3,
  "title": "Individual Session",
  "duration": "50 m",
  "type": "one_on_one",
  "description": "One-on-one therapy session for individual counseling",
  "slug": "rohnit-individual-session",
  "is_active": true,
  "created_at": "2024-03-01T10:00:00Z",
  "updated_at": "2024-03-01T10:00:00Z"
}
```

### Appointments Table
```json
{
  "id": 1,
  "therapist_id": 3,
  "client_id": null,
  "calendar_id": 1,
  "title": "Therapy Session with Meet P",
  "start_time": "2024-03-04T14:17:00Z",
  "end_time": "2024-03-04T15:07:00Z",
  "status": "scheduled",
  "google_event_id": "abc123xyz",
  "meet_link": "https://meet.google.com/xyz-abc-def",
  "client_email": "meet@example.com",
  "client_name": "Meet P",
  "created_at": "2024-03-04T10:00:00Z"
}
```

### Availability Table
```json
{
  "id": 1,
  "user_id": 3,
  "day_of_week": 1,
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "is_enabled": true,
  "created_at": "2024-03-01T10:00:00Z"
}
```

### Clients Table
```json
{
  "id": 1,
  "therapist_id": 3,
  "email": "client@example.com",
  "phone": "9876543210",
  "emergency_name": "John Doe",
  "emergency_phone": "9876543211",
  "emergency_relation": "Spouse",
  "age": "32",
  "occupation": "Software Engineer",
  "gender": "Male",
  "marital_status": "Married",
  "created_at": "2024-03-01T10:00:00Z",
  "updated_at": "2024-03-01T10:00:00Z"
}
```

### ClientActivities Table
```json
{
  "id": 1,
  "client_id": 1,
  "name": "Mood Tracking",
  "description": "Daily mood tracking exercise to monitor emotional patterns",
  "is_visible": true,
  "created_at": "2024-03-01T10:00:00Z"
}
```

### SessionNotes Table
```json
{
  "id": 1,
  "appointment_id": 1,
  "therapist_id": 3,
  "note_content": [
    {
      "type": "observation",
      "text": "Client showed improvement in anxiety management techniques"
    },
    {
      "type": "plan",
      "text": "Continue with CBT exercises, schedule follow-up in 2 weeks"
    }
  ],
  "created_at": "2024-03-04T15:10:00Z"
}
```

---

## Entity Relationship Diagram (ERD)

```
┌─────────────┐
│    Plans    │
│─────────────│
│ id (PK)     │
│ plan_name   │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────────────────────────────────────────┐
│                        Users                            │
│─────────────────────────────────────────────────────────│
│ id (PK), user_name, email, phone, plan (FK),           │
│ dob, gender, specialization, language_spoken,           │
│ country, state, city, pincode, clinic_address,          │
│ google_id, auth_provider, profile_picture               │
└──┬──────┬──────┬──────┬──────┬──────┬──────────────────┘
   │      │      │      │      │      │
   │1:N   │1:N   │1:N   │1:N   │1:N   │1:N
   │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼
┌──────┐ │   ┌────────┐ │   ┌──────────┐
│User  │ │   │Clients │ │   │Session   │
│Integ │ │   │        │ │   │Notes     │
│ration│ │   └───┬────┘ │   └──────────┘
└──────┘ │       │1:N   │
         │       ▼      │
         │   ┌──────────┐
         │   │Client    │
         │   │Activities│
         │   └──────────┘
         │
         ▼
    ┌─────────┐
    │Calendars│
    └────┬────┘
         │1:N
         ▼
    ┌────────────┐
    │Appointments│◄──┐
    └────────────┘   │
                     │1:1
                ┌────┴────┐
                │Session  │
                │Notes    │
                └─────────┘
```

---

*Last Updated: March 5, 2026*
