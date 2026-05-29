-- Create UserIntegrations table to store OAuth tokens
CREATE TABLE IF NOT EXISTS UserIntegrations (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'google',
    access_token VARCHAR(1024),
    refresh_token VARCHAR(1024),
    calendar_id VARCHAR(255),
    expiry_date BIGINT, -- Timestamp of expiration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider) -- One token set per provider per user
);
