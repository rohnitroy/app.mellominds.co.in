-- Create user_sessions table for tracking platform session time
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_time TIMESTAMP NOT NULL DEFAULT NOW(),
  logout_time TIMESTAMP,
  duration_minutes INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_logout CHECK (logout_time IS NULL OR logout_time > login_time)
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_login_time ON user_sessions(login_time);
