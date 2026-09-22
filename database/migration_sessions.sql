-- Server-side login session tracking. Until now JWTs were fully stateless: logout only wrote
-- an audit log entry and a token stayed valid (up to its 1-day expiry) even after "logout".
-- This table lets the backend actually revoke a session (real logout, password-change
-- invalidation, admin force-logout) and lets a user see/manage their own active devices.
CREATE TABLE IF NOT EXISTS Sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    jti VARCHAR(64) UNIQUE NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON Sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON Sessions(jti);
