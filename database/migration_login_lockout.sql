-- Account-lockout support: 3 consecutive wrong passwords locks the account for
-- 5 minutes (even a correct password is rejected until the lock expires).
ALTER TABLE Users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
