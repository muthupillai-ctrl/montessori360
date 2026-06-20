export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday';
export type AttendanceMode   = 'qr' | 'biometric' | 'manual';

// ── DB row ────────────────────────────────────────────────────────────────────
export interface AttendanceRow {
  id:              string;
  student_id:      string;
  date:            Date;
  check_in_time:   Date | null;
  check_out_time:  Date | null;
  status:          AttendanceStatus;
  mode:            AttendanceMode;
  marked_by:       string | null;
  parent_notified: boolean;
  notified_at:     Date | null;
  notes:           string | null;
  created_at:      Date;
  // Joined
  student_name?:   string;
  admission_no?:   string;
  class_name?:     string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
export interface CheckInDto {
  student_id: string;
  mode?:      AttendanceMode;
  notes?:     string;
}

export interface CheckOutDto {
  student_id: string;
  notes?:     string;
}

export interface BulkMarkDto {
  date?:     string;          // ISO date, defaults to today
  class_id?: string;          // shorthand: mark all active students in class
  status?:   AttendanceStatus;
  records?:  {
    student_id: string;
    status:     AttendanceStatus;
    notes?:     string;
  }[];
}

export interface AttendanceFilters {
  date?:      string;         // ISO date
  class_id?:  string;
  student_id?: string;
  status?:    AttendanceStatus;
  page?:      number;
  limit?:     number;
}

export interface MonthlyReportFilters {
  year:       number;
  month:      number;         // 1–12
  class_id?:  string;
  student_id?: string;
}

// ── Response shapes ───────────────────────────────────────────────────────────
export interface DailySummary {
  date:        string;
  total:       number;
  present:     number;
  absent:      number;
  late:        number;
  half_day:    number;
  not_marked:  number;
  records:     AttendanceRow[];
}

export interface MonthlyStudentReport {
  student_id:   string;
  student_name: string;
  admission_no: string;
  class_name:   string;
  total_days:   number;
  present:      number;
  absent:       number;
  late:         number;
  half_day:     number;
  percentage:   number;
}
