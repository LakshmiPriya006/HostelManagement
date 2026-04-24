/*
  # Add WhatsApp Reminder Settings to Hostels

  ## Changes
  - Add `whatsapp_reminders_enabled` boolean column to hostels table
    - Defaults to false (opt-in)
    - Allows owners to enable/disable automated WhatsApp rent reminders per hostel
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hostels' AND column_name = 'whatsapp_reminders_enabled'
  ) THEN
    ALTER TABLE hostels ADD COLUMN whatsapp_reminders_enabled boolean DEFAULT false;
  END IF;
END $$;
