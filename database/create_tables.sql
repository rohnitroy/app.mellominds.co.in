-- Connect to mello_db as mello_admin
\c mello_db mello_admin

-- Create Plans table
CREATE TABLE Plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL
);

-- Create Users table
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
    google_id VARCHAR(255) UNIQUE, -- Google OAuth ID
    auth_provider VARCHAR(50) DEFAULT 'email' CHECK (auth_provider IN ('email', 'google')), -- Authentication method
    profile_picture TEXT, -- Google profile image URL
    FOREIGN KEY (plan) REFERENCES Plans(id) ON DELETE RESTRICT
);
