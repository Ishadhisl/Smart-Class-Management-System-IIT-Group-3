-- The app only ever sends messages over WhatsApp (utils/whatsappService.js) - SMS/Twilio was
-- considered early on and dropped for cost, but the DB objects kept the old "SMS" name. This
-- brings the live database in line with schema.sql's WhatsApp_Logs / alert_sent naming without
-- losing any existing log data. Guarded so re-running it on every boot (see initSchema.js) is a
-- no-op once each rename has happened.

-- initSchema.js always runs schema.sql before migrations, and schema.sql's
-- `CREATE TABLE IF NOT EXISTS WhatsApp_Logs` fired on the very first deploy of this rename
-- (WhatsApp_Logs didn't exist yet at that point) - creating a fresh EMPTY WhatsApp_Logs
-- before the plain rename below got a chance to run, so it found WhatsApp_Logs already
-- existing and skipped itself. All the real historical log data stayed stuck under
-- SMS_Logs. This merges the two safely: recovers SMS_Logs under the right name, then
-- appends whatever few rows the empty replacement picked up in the meantime (with fresh
-- ids, since both tables' SERIAL log_id independently started from 1 and could collide).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sms_logs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_logs') THEN
    ALTER TABLE WhatsApp_Logs RENAME TO WhatsApp_Logs_Merge_Tmp;
    ALTER TABLE SMS_Logs RENAME TO WhatsApp_Logs;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'sms_type') THEN
      ALTER TABLE WhatsApp_Logs RENAME COLUMN sms_type TO message_type;
    END IF;
    -- The recovered table is SMS_Logs's original shape, which (confirmed live) never
    -- actually had these three columns despite smsService.js's INSERT listing them - every
    -- write silently failed at the DB layer (caught by its try/catch) while the WhatsApp
    -- send itself still went through, which is how this went unnoticed. Add them before the
    -- merge below, or the INSERT...SELECT's column list won't exist on the target table.
    ALTER TABLE WhatsApp_Logs ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR(50);
    ALTER TABLE WhatsApp_Logs ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'WhatsApp';
    ALTER TABLE WhatsApp_Logs ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255);
    -- The empty "duplicate" table (created by schema.sql's CREATE TABLE IF NOT EXISTS on
    -- the very first run of this rename, before this migration got a chance to run) can
    -- itself predate these 3 columns being added to schema.sql, so it may be missing them
    -- too - add them here as well or the SELECT below fails with "column does not exist".
    ALTER TABLE WhatsApp_Logs_Merge_Tmp ADD COLUMN IF NOT EXISTS whatsapp_status VARCHAR(50);
    ALTER TABLE WhatsApp_Logs_Merge_Tmp ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'WhatsApp';
    ALTER TABLE WhatsApp_Logs_Merge_Tmp ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255);
    INSERT INTO WhatsApp_Logs (parent_id, parent_phone, message_type, message_body, status, whatsapp_status, channel, parent_name, sent_at)
    SELECT parent_id, parent_phone, message_type, message_body, status, whatsapp_status, channel, parent_name, sent_at
    FROM WhatsApp_Logs_Merge_Tmp;
    DROP TABLE WhatsApp_Logs_Merge_Tmp;
  END IF;
END $$;

-- Plain rename path, for a DB that never hit the duplicate-table case above (e.g. a fresh
-- install that already only has SMS_Logs with no WhatsApp_Logs yet).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sms_logs')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_logs') THEN
    ALTER TABLE SMS_Logs RENAME TO WhatsApp_Logs;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'sms_type') THEN
    ALTER TABLE WhatsApp_Logs RENAME COLUMN sms_type TO message_type;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hall_congestion_tracker' AND column_name = 'sms_sent') THEN
    ALTER TABLE Hall_Congestion_Tracker RENAME COLUMN sms_sent TO alert_sent;
  END IF;
END $$;
