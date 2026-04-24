export type UserRole = 'owner' | 'hosteller';

export interface UserRoleRecord {
  id: string;
  role: UserRole;
  created_at: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface Hostel {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  city: string;
  total_floors: number;
  rules_and_regulations: string;
  upi_id: string;
  late_fee_amount: number;
  rent_due_date_day: number;
  whatsapp_reminders_enabled?: boolean;
  created_at: string;
}

export interface Floor {
  id: string;
  hostel_id: string;
  floor_number: number;
  created_at: string;
}

export type RoomType = 'ac' | 'non-ac';
export type SharingType = 'single' | 'double' | 'triple';
export type RoomStatus = 'available' | 'occupied' | 'partial';

export interface Room {
  id: string;
  floor_id: string;
  hostel_id: string;
  room_number: string;
  room_type: RoomType;
  sharing_type: SharingType;
  rent_amount: number;
  status: RoomStatus;
  created_at: string;
}

export type HostellerStatus = 'active' | 'moved_out';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Hosteller {
  id: string;
  owner_id: string;
  hostel_id: string;
  room_id: string | null;
  name: string;
  email: string;
  phone: string;
  aadhar_number: string;
  profile_photo_url: string;
  move_in_date: string;
  move_out_date: string | null;
  status: HostellerStatus;
  approval_status: ApprovalStatus;
  allow_roommate_details: boolean;
  created_at: string;
}

export type PaymentStatus = 'paid' | 'unpaid' | 'overdue';
export type PaymentMode = 'upi' | 'cash';

export interface RentPayment {
  id: string;
  hosteller_id: string;
  hostel_id: string;
  room_id: string;
  month: number;
  year: number;
  amount: number;
  fine_amount: number;
  status: PaymentStatus;
  payment_mode: PaymentMode;
  paid_at: string | null;
  marked_by_owner: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  hostel_id: string;
  owner_id: string;
  title: string;
  content: string;
  scheduled_at: string | null;
  created_at: string;
}

export type ProblemStatus = 'open' | 'in_progress' | 'resolved';

export interface Problem {
  id: string;
  hosteller_id: string;
  hostel_id: string;
  title: string;
  description: string;
  status: ProblemStatus;
  created_at: string;
}

export type QuestionType = 'text' | 'rating' | 'multiple_choice';

export interface FeedbackQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
}

export interface FeedbackForm {
  id: string;
  hostel_id: string;
  owner_id: string;
  title: string;
  questions: FeedbackQuestion[];
  created_at: string;
}

export interface FeedbackResponse {
  id: string;
  form_id: string;
  hosteller_id: string;
  answers: Record<string, string | number>;
  submitted_at: string;
}

export type NotificationType = 'rent_reminder' | 'announcement' | 'feedback_request' | 'problem_update' | 'general';

export interface Notification {
  id: string;
  user_id: string;
  user_role: UserRole;
  type: NotificationType;
  message: string;
  is_read: boolean;
  reference_id: string | null;
  created_at: string;
}

export interface RoomHistory {
  id: string;
  room_id: string;
  hosteller_id: string;
  hosteller_name: string;
  move_in_date: string | null;
  move_out_date: string | null;
  archived_at: string;
}

export interface RoomWithFloor extends Room {
  floor?: Floor;
}

export interface HostellerWithRoom extends Hosteller {
  room?: Room;
  floor?: Floor;
}

export interface RentPaymentWithHosteller extends RentPayment {
  hosteller?: Hosteller;
  room?: Room;
}
