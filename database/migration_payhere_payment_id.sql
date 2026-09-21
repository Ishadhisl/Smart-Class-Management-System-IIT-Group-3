-- Migration: Add PayHere payment ID column to Payments table
ALTER TABLE Payments ADD COLUMN IF NOT EXISTS payhere_payment_id VARCHAR(100);
