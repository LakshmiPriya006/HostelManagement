-- 1. Modify rent_payments status constraint
ALTER TABLE rent_payments DROP CONSTRAINT IF EXISTS rent_payments_status_check;
ALTER TABLE rent_payments ADD CONSTRAINT rent_payments_status_check CHECK (status IN ('paid', 'unpaid', 'overdue', 'pending'));

-- 2. Add default_hosteller_password to hostels and aadhar_url to hostellers
ALTER TABLE hostels ADD COLUMN IF NOT EXISTS default_hosteller_password text DEFAULT '123456';
ALTER TABLE hostellers ADD COLUMN IF NOT EXISTS aadhar_url text DEFAULT '';

-- 3. Create documents storage bucket and RLS
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT DO NOTHING;

-- RLS for documents bucket (owners can insert/read/update/delete, hostellers can read)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'documents' );
CREATE POLICY "Owners can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'documents' AND (SELECT role FROM user_roles WHERE id = auth.uid()) = 'owner' );
CREATE POLICY "Owners can update" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'documents' AND (SELECT role FROM user_roles WHERE id = auth.uid()) = 'owner' );
CREATE POLICY "Owners can delete" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'documents' AND (SELECT role FROM user_roles WHERE id = auth.uid()) = 'owner' );

-- 4. Security Patch: Redefine helper functions without arguments
CREATE OR REPLACE FUNCTION public.get_hosteller_room_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT room_id FROM hostellers WHERE id = auth.uid() AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_hosteller_hostel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hostel_id FROM hostellers WHERE id = auth.uid() AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_hosteller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM hostellers WHERE id = auth.uid() AND status = 'active');
$$;

-- Update Policies

DROP POLICY IF EXISTS "Hostellers read hostel announcements" ON announcements;
CREATE POLICY "Hostellers read hostel announcements" ON announcements FOR SELECT TO authenticated USING ( hostel_id = get_hosteller_hostel_id() );

DROP POLICY IF EXISTS "Hostellers read hostel feedback forms" ON feedback_forms;
CREATE POLICY "Hostellers read hostel feedback forms" ON feedback_forms FOR SELECT TO authenticated USING ( hostel_id = get_hosteller_hostel_id() );

DROP POLICY IF EXISTS "Hostellers read assigned room" ON rooms;
CREATE POLICY "Hostellers read assigned room" ON rooms FOR SELECT TO authenticated USING ( id = get_hosteller_room_id() );

DROP POLICY IF EXISTS "Hostellers read floors of own hostel" ON floors;
CREATE POLICY "Hostellers read floors of own hostel" ON floors FOR SELECT TO authenticated USING ( hostel_id = get_hosteller_hostel_id() );

DROP POLICY IF EXISTS "Hostellers read own hostel" ON hostels;
CREATE POLICY "Hostellers read own hostel" ON hostels FOR SELECT TO authenticated USING ( id = get_hosteller_hostel_id() );

DROP POLICY IF EXISTS "Hostellers insert problems" ON problems;
CREATE POLICY "Hostellers insert problems" ON problems FOR INSERT TO authenticated WITH CHECK ( hosteller_id = auth.uid() AND hostel_id = get_hosteller_hostel_id() );

DROP POLICY IF EXISTS "Hostellers read roommate names in same room" ON hostellers;
CREATE POLICY "Hostellers read roommate names in same room" ON hostellers FOR SELECT TO authenticated USING ( room_id IS NOT NULL AND status = 'active' AND allow_roommate_details = true AND room_id = get_hosteller_room_id() AND id != auth.uid() );

-- Now drop the old functions
DROP FUNCTION IF EXISTS public.get_hosteller_room_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_hosteller_hostel_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_active_hosteller(uuid) CASCADE;
