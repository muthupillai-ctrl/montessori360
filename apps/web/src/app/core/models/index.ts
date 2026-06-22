// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email:      string;
  password:   string;
  tenantCode: string;
}

export interface LoginResponse {
  accessToken: string;
  user:        AuthUser;
}

export interface AuthUser {
  id:       string;
  email:    string;
  role:     string;
  name:     string;
  tenantId: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data:    T;
  message?: string;
}

// ── Student ───────────────────────────────────────────────────────────────────

export interface Student {
  id:                  string;
  admission_no:        string;
  first_name:          string;
  last_name:           string;
  dob:                 string;
  gender:              'male' | 'female' | 'other' | null;
  class_id:            string | null;
  class_name?:         string;
  blood_group:         string | null;
  nationality:         string;
  emergency_contacts:  EmergencyContact[];
  medical_notes:       Record<string, unknown>;
  dietary_notes:       string | null;
  allergies:           string[];
  admission_date:      string;
  is_active:           boolean;
  created_at:          string;
  rfid_uid:            string | null;
}

export interface EmergencyContact {
  name:       string;
  relation:   string;
  phone:      string;
  is_primary: boolean;
}

export interface SchoolClass {
  id:             string;
  name:           string;
  age_group_min:  number | null;
  age_group_max:  number | null;
  capacity:       number;
  enrolled_count: number;
  teacher_id?:    string | null;
  teacher_name:   string | null;
  is_active:      boolean;
  created_at?:    string;
  updated_at?:    string;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id:             string;
  student_id:     string;
  student_name?:  string;
  admission_no?:  string;
  class_name?:    string;
  date:           string;
  check_in_time:  string | null;
  check_out_time: string | null;
  status:         'present' | 'absent' | 'late' | 'half_day' | 'holiday' | 'not_marked';
  mode:           'qr' | 'biometric' | 'manual' | null;
  notes?:         string | null;
}

export interface DailySummary {
  date:       string;
  total:      number;
  present:    number;
  absent:     number;
  late:       number;
  half_day:   number;
  not_marked: number;
  records:    AttendanceRecord[];
}

// ── Fees ──────────────────────────────────────────────────────────────────────

export interface FeeInvoice {
  id:               string;
  invoice_no:       string;
  student_id:       string;
  student_name?:    string;
  admission_no?:    string;
  class_name?:      string;
  fee_structure_id?: string | null;
  billing_period:   string;
  line_items:       LineItem[] | string;
  subtotal:         number;
  discount:         number;
  discount_note?:   string | null;
  concession_id?:   string | null;
  tax:              number;
  total:            number;
  due_date:         string;
  status:           'pending' | 'paid' | 'partial' | 'overdue' | 'waived';
  paid_amount:      number;
  paid_at:          string | null;
  payment_method:   string | null;
  created_at?:      string;
  payments?:        FeePayment[];
}

export interface FeePayment {
  id:           string;
  amount:       number;
  method:       string;
  reference_no?: string;
  notes?:       string;
  paid_at:      string;
}

export interface LineItem {
  name:   string;
  amount: number;
}

export interface FeeStructure {
  id:             string;
  name:           string;
  academic_year:  string;
  billing_cycle:  string;
  applies_to:     'all' | 'class';
  class_ids:      string[];
  heads:          FeeHead[];
  is_active:      boolean;
  allow_multiple: boolean;
}

export interface FeeHead {
  name:        string;
  amount:      number;
  is_optional: boolean;
}

// ── Communication ─────────────────────────────────────────────────────────────

export interface Announcement {
  id:           string;
  title:        string;
  body:         string;
  audience:     'all' | 'staff' | 'parents' | 'class';
  class_ids:    string[];
  published_at: string | null;
  expires_at:   string | null;
  author_name?: string;
  created_at:   string;
}

export interface Message {
  id:             string;
  sender_id:      string;
  sender_name?:   string;
  recipient_id:   string;
  recipient_name?: string;
  body:           string;
  is_read:        boolean;
  created_at:     string;
}

export interface Conversation {
  partner_id:      string;
  partner_name:    string;
  partner_type:    'staff' | 'parent';
  last_message:    string;
  last_message_at: string;
  unread_count:    number;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface DashboardData {
  generated_at:  string;
  academic_year: string | null;
  students: {
    total_enrolled: number;
    active:         number;
    new_this_month: number;
    by_class:       { class_name: string; count: number; capacity: number; fill_pct: number }[];
  };
  attendance: {
    today: { total: number; present: number; absent: number; late: number; not_marked: number; rate_pct: number; date: string };
    weekly_trend: { date: string; present: number; total: number; rate_pct: number }[];
    monthly_avg: number;
  };
  fees: {
    current_month: { billed: number; collected: number; outstanding: number; collection_pct: number };
    by_status: { pending: number; paid: number; partial: number; overdue: number; waived: number };
    defaulters_count: number;
  };
  staff: {
    total_active: number;
    pending_leaves: number;
    on_leave_today: number;
  };
  communication: {
    unread_messages: number;
    pending_ack_circulars: number;
  };
  journals: {
    today: { total_students: number; journals_created: number; journals_published: number; completion_pct: number };
  };
  observations: {
    overall_mastery_pct: number;
  };
  transport: {
    active_routes: number;
    trips_in_progress: number;
  };
}
