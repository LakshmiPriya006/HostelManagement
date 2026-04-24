/*
  # Fix infinite recursion in hostellers RLS policy

  The policy "Hostellers read roommates when allowed" caused infinite recursion
  because it had a subquery referencing the `hostellers` table inside a policy
  on `hostellers` itself. PostgreSQL cannot resolve this self-referential check.

  Fix: Replace the recursive policy with a SECURITY DEFINER function that
  bypasses RLS for the internal lookup, breaking the recursion cycle.
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Hostellers read roommates when allowed" ON hostellers;

-- Create a security definer function that safely checks room membership
-- without triggering RLS policies on hostellers
CREATE OR REPLACE FUNCTION get_hosteller_room_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT room_id FROM hostellers WHERE id = p_user_id AND status = 'active' LIMIT 1;
$$;

-- Recreate the policy using the function instead of a self-referential subquery
CREATE POLICY "Hostellers read roommates when allowed"
  ON hostellers FOR SELECT
  TO authenticated
  USING (
    room_id IS NOT NULL
    AND status = 'active'
    AND allow_roommate_details = true
    AND room_id = get_hosteller_room_id(auth.uid())
    AND id != auth.uid()
  );
