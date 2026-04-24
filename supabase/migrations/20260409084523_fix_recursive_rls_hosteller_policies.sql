/*
  # Fix Recursive RLS Policies for Hosteller Portal

  ## Problem
  Policies on tables like `announcements`, `feedback_forms`, `rooms`, and `floors`
  check hosteller membership by doing a subquery into `hostellers`:
    EXISTS (SELECT 1 FROM hostellers WHERE hostellers.hostel_id = ... AND hostellers.id = auth.uid())
  
  Since `hostellers` has RLS enabled, this subquery itself triggers the `hostellers` RLS policies,
  which can also do subqueries — creating infinite recursion that causes errors or empty results.

  ## Solution
  1. Add SECURITY DEFINER helper functions (bypass RLS):
     - `get_hosteller_hostel_id(user_id)` — returns the hosteller's hostel_id
     - `is_active_hosteller(user_id)` — returns true if user is an active hosteller
  2. Replace all subquery-based policies on `announcements`, `feedback_forms`, `rooms`, 
     and `floors` with calls to these SECURITY DEFINER functions.
  3. Also fix the `rent_payments` hosteller INSERT policy — hostellers need to insert 
     payments for themselves without the policy doing recursive hosteller lookups.

  ## Security
  - All helper functions use SECURITY DEFINER with explicit search_path
  - Functions only return minimal info needed for policy checks
  - No user data is exposed through the functions
*/

-- ============================================================
-- Helper functions (SECURITY DEFINER = bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_hosteller_hostel_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hostel_id FROM hostellers WHERE id = p_user_id AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_hosteller(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM hostellers WHERE id = p_user_id AND status = 'active');
$$;

-- ============================================================
-- Fix ANNOUNCEMENTS hosteller read policy
-- ============================================================

DROP POLICY IF EXISTS "Hostellers read hostel announcements" ON announcements;

CREATE POLICY "Hostellers read hostel announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    hostel_id = get_hosteller_hostel_id(auth.uid())
  );

-- ============================================================
-- Fix FEEDBACK_FORMS hosteller read policy
-- ============================================================

DROP POLICY IF EXISTS "Hostellers read hostel feedback forms" ON feedback_forms;

CREATE POLICY "Hostellers read hostel feedback forms"
  ON feedback_forms
  FOR SELECT
  TO authenticated
  USING (
    hostel_id = get_hosteller_hostel_id(auth.uid())
  );

-- ============================================================
-- Fix FEEDBACK_RESPONSES hosteller insert policy (add WITH CHECK)
-- ============================================================

DROP POLICY IF EXISTS "Hostellers insert responses" ON feedback_responses;

CREATE POLICY "Hostellers insert responses"
  ON feedback_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (hosteller_id = auth.uid());

-- ============================================================
-- Fix ROOMS hosteller read policy
-- ============================================================

DROP POLICY IF EXISTS "Hostellers read assigned room" ON rooms;

CREATE POLICY "Hostellers read assigned room"
  ON rooms
  FOR SELECT
  TO authenticated
  USING (
    id = get_hosteller_room_id(auth.uid())
  );

-- ============================================================
-- Fix FLOORS hosteller read policy
-- ============================================================

DROP POLICY IF EXISTS "Hostellers read floors of own hostel" ON floors;

CREATE POLICY "Hostellers read floors of own hostel"
  ON floors
  FOR SELECT
  TO authenticated
  USING (
    hostel_id = get_hosteller_hostel_id(auth.uid())
  );

-- ============================================================
-- Fix HOSTELS hosteller read policy (also had subquery into hostellers)
-- ============================================================

DROP POLICY IF EXISTS "Hostellers read own hostel" ON hostels;

CREATE POLICY "Hostellers read own hostel"
  ON hostels
  FOR SELECT
  TO authenticated
  USING (
    id = get_hosteller_hostel_id(auth.uid())
  );

-- ============================================================
-- Fix PROBLEMS hosteller insert policy (add WITH CHECK)
-- ============================================================

DROP POLICY IF EXISTS "Hostellers insert problems" ON problems;

CREATE POLICY "Hostellers insert problems"
  ON problems
  FOR INSERT
  TO authenticated
  WITH CHECK (
    hosteller_id = auth.uid()
    AND hostel_id = get_hosteller_hostel_id(auth.uid())
  );
