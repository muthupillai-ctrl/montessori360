export type StaffRole =
  | 'owner' | 'principal' | 'teacher'
  | 'assistant_teacher' | 'accountant' | 'driver' | 'support';

export type LeaveType    = 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'lwp' | 'other';
export type LeaveStatus  = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ShiftType    = 'morning' | 'afternoon' | 'full_day' | 'split';
export type PayFrequency = 'monthly' | 'weekly';

// ── DB rows ───────────────────────────────────────────────────────────────────

export interface StaffRow {
  id:             string;
  email:          string;
  role:           StaffRole;
  first_name:     string;
  last_name:      string;
  phone:          string | null;
  dob:            string | null;
  joining_date:   string | null;
  qualifications: Qualification[];
  profile_photo:  string | null;
  is_active:      boolean;
  created_at:     Date;
  updated_at:     Date;
  // Extended fields (from staff_details)
  employee_no?:   string;
  department?:    string;
  designation?:   string;
  salary?:        number;
  pay_frequency?: PayFrequency;
  bank_account?:  string;
  bank_ifsc?:     string;
  pan_no?:        string;
  aadhar_no?:     string;
  address?:       string;
  emergency_contact?: EmergencyContact;
}

export interface Qualification {
  degree:       string;
  institution:  string;
  year:         number;
}

export interface EmergencyContact {
  name:     string;
  relation: string;
  phone:    string;
}

export interface LeaveBalanceRow {
  id:           string;
  staff_id:     string;
  academic_year: string;
  casual:       number;
  sick:         number;
  earned:       number;
  casual_used:  number;
  sick_used:    number;
  earned_used:  number;
  updated_at:   Date;
}

export interface LeaveRequestRow {
  id:           string;
  staff_id:     string;
  leave_type:   LeaveType;
  from_date:    string;
  to_date:      string;
  days:         number;
  reason:       string;
  status:       LeaveStatus;
  reviewed_by:  string | null;
  reviewed_at:  Date | null;
  review_note:  string | null;
  created_at:   Date;
  updated_at:   Date;
  // Joined
  staff_name?:  string;
  reviewer_name?: string;
}

export interface ShiftRow {
  id:          string;
  staff_id:    string;
  date:        string;
  shift_type:  ShiftType;
  start_time:  string;
  end_time:    string;
  notes:       string | null;
  created_at:  Date;
  // Joined
  staff_name?: string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateStaffDto {
  email:          string;
  password:       string;
  role:           StaffRole;
  first_name:     string;
  last_name:      string;
  phone?:         string;
  dob?:           string;
  joining_date?:  string;
  qualifications?: Qualification[];
  // Details
  employee_no?:   string;
  department?:    string;
  designation?:   string;
  salary?:        number;
  pay_frequency?: PayFrequency;
  bank_account?:  string;
  bank_ifsc?:     string;
  pan_no?:        string;
  aadhar_no?:     string;
  address?:       string;
  emergency_contact?: EmergencyContact;
}

export interface UpdateStaffDto extends Partial<Omit<CreateStaffDto, 'email' | 'password'>> {}

export interface RequestLeaveDto {
  leave_type:  LeaveType;
  from_date:   string;
  to_date:     string;
  reason:      string;
}

export interface ReviewLeaveDto {
  status:      'approved' | 'rejected';
  review_note?: string;
}

export interface CreateShiftDto {
  staff_id:    string;
  date:        string;
  shift_type:  ShiftType;
  start_time:  string;
  end_time:    string;
  notes?:      string;
}

export interface StaffFilters {
  role?:       StaffRole;
  is_active?:  boolean;
  search?:     string;
  page?:       number;
  limit?:      number;
}

export interface LeaveFilters {
  staff_id?:   string;
  status?:     LeaveStatus;
  leave_type?: LeaveType;
  from?:       string;
  to?:         string;
  page?:       number;
  limit?:      number;
}

export interface PayrollExportFilters {
  month:       number;
  year:        number;
  role?:       StaffRole;
}
