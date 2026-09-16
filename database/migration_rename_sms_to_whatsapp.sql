-- The app only ever sends messages over WhatsApp (utils/whatsappService.js) - SMS/Twilio was
-- considered early on and dropped for cost, but the DB objects kept the old "SMS" name. This
-- brings the live database in line with schema.sql's WhatsApp_Logs / alert_sent naming without
-- losing any existing log data. Guarded so re-running it on every boot (see initSchema.js) is a
-- no-op once each rename has happened.

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
