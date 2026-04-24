/*
  # HostelOS - Core Tables (No cross-reference policies)
  
  Creates all tables with basic RLS policies.
  Cross-referencing policies added in next migration.
*/

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'hosteller' CHECK (role IN ('owner', 'hosteller')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role" ON user_roles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own role" ON user_roles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Owners
CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own profile" ON owners FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Owners insert own profile" ON owners FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Owners update own profile" ON owners FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Hostels
CREATE TABLE IF NOT EXISTS hostels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  total_floors integer NOT NULL DEFAULT 1,
  rules_and_regulations text DEFAULT '',
  upi_id text DEFAULT '',
  late_fee_amount numeric(10,2) DEFAULT 0,
  rent_due_date_day integer DEFAULT 5 CHECK (rent_due_date_day BETWEEN 1 AND 28),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own hostels" ON hostels FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners insert own hostels" ON hostels FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update own hostels" ON hostels FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete own hostels" ON hostels FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Floors
CREATE TABLE IF NOT EXISTS floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  floor_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read floors" ON floors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = floors.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners insert floors" ON floors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners update floors" ON floors FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = floors.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners delete floors" ON floors FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = floors.hostel_id AND hostels.owner_id = auth.uid()));

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id uuid NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_number text NOT NULL DEFAULT '',
  room_type text NOT NULL DEFAULT 'non-ac' CHECK (room_type IN ('ac', 'non-ac')),
  sharing_type text NOT NULL DEFAULT 'single' CHECK (sharing_type IN ('single', 'double', 'triple')),
  rent_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'partial')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read rooms" ON rooms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = rooms.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners insert rooms" ON rooms FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners update rooms" ON rooms FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = rooms.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners delete rooms" ON rooms FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = rooms.hostel_id AND hostels.owner_id = auth.uid()));

-- Hostellers
CREATE TABLE IF NOT EXISTS hostellers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  aadhar_number text DEFAULT '',
  profile_photo_url text DEFAULT '',
  move_in_date date DEFAULT CURRENT_DATE,
  move_out_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'moved_out')),
  allow_roommate_details boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hostellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read hostellers" ON hostellers FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners insert hostellers" ON hostellers FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update hostellers" ON hostellers FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete hostellers" ON hostellers FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Hostellers read own profile" ON hostellers FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Hostellers update own profile" ON hostellers FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Rent Payments
CREATE TABLE IF NOT EXISTS rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hosteller_id uuid NOT NULL REFERENCES hostellers(id) ON DELETE CASCADE,
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  fine_amount numeric(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'overdue')),
  payment_mode text DEFAULT 'upi' CHECK (payment_mode IN ('upi', 'cash')),
  paid_at timestamptz,
  marked_by_owner boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read rent payments" ON rent_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = rent_payments.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners insert rent payments" ON rent_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners update rent payments" ON rent_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = rent_payments.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Hostellers read own payments" ON rent_payments FOR SELECT TO authenticated USING (hosteller_id = auth.uid());
CREATE POLICY "Hostellers insert own payments" ON rent_payments FOR INSERT TO authenticated WITH CHECK (hosteller_id = auth.uid());
CREATE POLICY "Hostellers update own payments" ON rent_payments FOR UPDATE TO authenticated USING (hosteller_id = auth.uid()) WITH CHECK (hosteller_id = auth.uid());

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own announcements" ON announcements FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners insert announcements" ON announcements FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update announcements" ON announcements FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete announcements" ON announcements FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Hostellers read hostel announcements" ON announcements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostellers WHERE hostellers.hostel_id = announcements.hostel_id AND hostellers.id = auth.uid() AND hostellers.status = 'active'));

-- Problems
CREATE TABLE IF NOT EXISTS problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hosteller_id uuid NOT NULL REFERENCES hostellers(id) ON DELETE CASCADE,
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read problems" ON problems FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = problems.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners update problems" ON problems FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM hostels WHERE hostels.id = problems.hostel_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Hostellers read own problems" ON problems FOR SELECT TO authenticated USING (hosteller_id = auth.uid());
CREATE POLICY "Hostellers insert problems" ON problems FOR INSERT TO authenticated WITH CHECK (hosteller_id = auth.uid());

-- Feedback Forms
CREATE TABLE IF NOT EXISTS feedback_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  questions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own feedback forms" ON feedback_forms FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners insert feedback forms" ON feedback_forms FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update feedback forms" ON feedback_forms FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete feedback forms" ON feedback_forms FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Hostellers read hostel feedback forms" ON feedback_forms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostellers WHERE hostellers.hostel_id = feedback_forms.hostel_id AND hostellers.id = auth.uid() AND hostellers.status = 'active'));

-- Feedback Responses
CREATE TABLE IF NOT EXISTS feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES feedback_forms(id) ON DELETE CASCADE,
  hosteller_id uuid NOT NULL REFERENCES hostellers(id) ON DELETE CASCADE,
  answers jsonb DEFAULT '{}',
  submitted_at timestamptz DEFAULT now()
);

ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read feedback responses" ON feedback_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM feedback_forms WHERE feedback_forms.id = feedback_responses.form_id AND feedback_forms.owner_id = auth.uid()));
CREATE POLICY "Hostellers read own responses" ON feedback_responses FOR SELECT TO authenticated USING (hosteller_id = auth.uid());
CREATE POLICY "Hostellers insert responses" ON feedback_responses FOR INSERT TO authenticated WITH CHECK (hosteller_id = auth.uid());

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role text NOT NULL DEFAULT 'hosteller' CHECK (user_role IN ('owner', 'hosteller')),
  type text NOT NULL DEFAULT 'general',
  message text NOT NULL DEFAULT '',
  is_read boolean DEFAULT false,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authenticated can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Room History
CREATE TABLE IF NOT EXISTS room_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  hosteller_id uuid NOT NULL REFERENCES hostellers(id) ON DELETE CASCADE,
  hosteller_name text NOT NULL DEFAULT '',
  move_in_date date,
  move_out_date date,
  archived_at timestamptz DEFAULT now()
);

ALTER TABLE room_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read room history" ON room_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rooms JOIN hostels ON hostels.id = rooms.hostel_id WHERE rooms.id = room_history.room_id AND hostels.owner_id = auth.uid()));
CREATE POLICY "Owners insert room history" ON room_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM rooms JOIN hostels ON hostels.id = rooms.hostel_id WHERE rooms.id = room_id AND hostels.owner_id = auth.uid()));

-- Rooms policy for hostellers (after hostellers table exists)
CREATE POLICY "Hostellers read assigned room" ON rooms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostellers WHERE hostellers.room_id = rooms.id AND hostellers.id = auth.uid() AND hostellers.status = 'active'));

-- Hostellers read roommates policy
CREATE POLICY "Hostellers read roommates when allowed" ON hostellers FOR SELECT TO authenticated
  USING (
    room_id IS NOT NULL AND status = 'active' AND allow_roommate_details = true AND
    EXISTS (SELECT 1 FROM hostellers h2 WHERE h2.room_id = hostellers.room_id AND h2.id = auth.uid() AND h2.status = 'active')
  );

-- Floors accessible to hostellers
CREATE POLICY "Hostellers read floors of own hostel" ON floors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM hostellers WHERE hostellers.hostel_id = floors.hostel_id AND hostellers.id = auth.uid() AND hostellers.status = 'active'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hostels_owner_id ON hostels(owner_id);
CREATE INDEX IF NOT EXISTS idx_floors_hostel_id ON floors(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor_id ON rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_hostellers_hostel_id ON hostellers(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostellers_room_id ON hostellers(room_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_hosteller_id ON rent_payments(hosteller_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_hostel_id ON rent_payments(hostel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_announcements_hostel_id ON announcements(hostel_id);
CREATE INDEX IF NOT EXISTS idx_problems_hostel_id ON problems(hostel_id);
