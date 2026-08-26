-- Migration: Add OTP_Store table (required by authController forgotPassword/verifyOtp/resetWithOtp)
CREATE TABLE IF NOT EXISTS OTP_Store (
    otp_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_username ON OTP_Store(username);
