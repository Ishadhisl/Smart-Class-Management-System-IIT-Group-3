-- Normalise Payments.payment_method labels (2026-09-21).
-- Old test/sandbox rows were written as "Card (Dummy)", "Card (Sandbox Mock)",
-- "Card (Stripe)"; they are all card payments made online.
-- Run once against each environment (local + Neon):
--   psql "$DATABASE_URL" -f database/migration_payment_method_labels.sql
BEGIN;
UPDATE Payments
   SET payment_method = 'Online (Card)'
 WHERE payment_method ILIKE 'card%' OR payment_method ILIKE '%stripe%' OR payment_method ILIKE '%sandbox%';
UPDATE Payments SET payment_method = 'Cash' WHERE payment_method IS NULL OR TRIM(payment_method) = '';
COMMIT;

-- Legacy Class_Schedules rows stored the day as a Postgres array literal ({"Friday"}),
-- which the hall-conflict check (cs.day_of_week = $1) never matched. Store the plain day.
UPDATE Class_Schedules
   SET day_of_week = TRIM(BOTH '{}"' FROM day_of_week)
 WHERE day_of_week LIKE '{%';
