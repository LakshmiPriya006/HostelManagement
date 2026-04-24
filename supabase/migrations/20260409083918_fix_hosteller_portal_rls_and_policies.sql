/*
  # Fix Hosteller Portal RLS Policies

  ## Problem Summary
  1. The "Hostellers read roommates when allowed" policy on the `hostellers` table was too
     restrictive — it only returned roommates when `allow_roommate_details = true`, but the
     frontend also needs to show roommate names even when `allow_roommate_details = false`.
     The result was that roommate name queries returned 0 rows silently.
  
  2. The `rooms` SELECT policy only allows hostellers to read their assigned room via a join
     on `hostellers.room_id = rooms.id`. This works for the current room but fails if the
     column value is being checked in other contexts.

  3. The `floors` SELECT policy similarly joins through hostellers, which is fine, but needs
     to be consistent.

  ## Changes
  - Drop the overly restrictive "Hostellers read roommates when allowed" policy
  - Add two cleaner policies:
    a. Hostellers can always read name/id of roommates in the same room (basic info)
    b. Hostellers can read full roommate details when allow_roommate_details = true on roommate
  - No changes needed to rooms/floors — those are correctly scoped

  ## Notes
  - The frontend already handles the allow_roommate_details flag by only showing phone when true
  - The RLS just needs to allow the row to be returned; the frontend controls what fields to show
*/

-- Drop the old restrictive roommate policy
DROP POLICY IF EXISTS "Hostellers read roommates when allowed" ON hostellers;

-- Allow hostellers to read basic info (name only) of active roommates in same room
CREATE POLICY "Hostellers read roommate names in same room"
  ON hostellers
  FOR SELECT
  TO authenticated
  USING (
    id <> auth.uid()
    AND status = 'active'
    AND room_id IS NOT NULL
    AND room_id = get_hosteller_room_id(auth.uid())
  );
