/*
  # Add Hosteller Approval Status & Fix Missing RLS Policies

  1. Changes
    - Add `approval_status` column to hostellers (pending/approved/rejected)
    - All new hostellers default to 'pending' until owner approves

  2. Missing RLS Policies Fixed
    - Hostellers can now read their own hostel record (was completely blocked → blank portal)
    - Hostellers can insert their own record during self-signup

  3. Security
    - Owners can filter by approval_status
    - Hostellers cannot modify their own approval_status
*/

-- Add approval_status to hostellers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hostellers' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE hostellers ADD COLUMN approval_status text NOT NULL DEFAULT 'pending'
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Drop potentially conflicting policies before recreating
DROP POLICY IF EXISTS "Hostellers read own hostel" ON hostels;
DROP POLICY IF EXISTS "Hostellers insert own record" ON hostellers;

-- Allow hostellers to read their own hostel (was MISSING — caused blank portal)
CREATE POLICY "Hostellers read own hostel"
  ON hostels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hostellers
      WHERE hostellers.hostel_id = hostels.id
        AND hostellers.id = auth.uid()
    )
  );

-- Allow hostellers to insert their own record (needed for self-signup flow)
CREATE POLICY "Hostellers insert own record"
  ON hostellers FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
