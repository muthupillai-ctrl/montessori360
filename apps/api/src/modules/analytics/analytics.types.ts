// ── Individual metric blocks ───────────────────────────────────────────────────

export interface StudentMetrics {
  total_enrolled:    number;
  active:            number;
  new_this_month:    number;
  by_class:          ClassBreakdown[];
  by_gender:         GenderBreakdown;
}

export interface ClassBreakdown {
  class_id:   string;
  class_name: string;
  count:      number;
  capacity:   number;
  fill_pct:   number;
}

export interface GenderBreakdown {
  male:   number;
  female: number;
  other:  number;
}

export interface AttendanceMetrics {
  today: {
    date:        string;
    total:       number;
    present:     number;
    absent:      number;
    late:        number;
    not_marked:  number;
    rate_pct:    number;
  };
  weekly_trend:  DayAttendance[];
  monthly_avg:   number;
  by_class:      ClassAttendance[];
}

export interface DayAttendance {
  date:      string;
  present:   number;
  total:     number;
  rate_pct:  number;
}

export interface ClassAttendance {
  class_id:   string;
  class_name: string;
  rate_pct:   number;
}

export interface FeeMetrics {
  current_month: {
    billed:       number;
    collected:    number;
    outstanding:  number;
    collection_pct: number;
  };
  ytd: {
    billed:       number;
    collected:    number;
    outstanding:  number;
  };
  by_status: {
    pending:  number;
    paid:     number;
    partial:  number;
    overdue:  number;
    waived:   number;
  };
  defaulters_count: number;
  recent_payments:  RecentPayment[];
}

export interface RecentPayment {
  student_name: string;
  amount:       number;
  method:       string;
  paid_at:      string;
}

export interface StaffMetrics {
  total_active:        number;
  by_role:             RoleBreakdown[];
  pending_leaves:      number;
  on_leave_today:      number;
  shifts_today:        number;
}

export interface RoleBreakdown {
  role:  string;
  count: number;
}

export interface CommunicationMetrics {
  unread_messages:          number;
  pending_ack_circulars:    number;
  announcements_this_week:  number;
}

export interface JournalMetrics {
  today: {
    total_students:    number;
    journals_created:  number;
    journals_published: number;
    completion_pct:    number;
  };
  mood_this_week: {
    happy:     number;
    calm:      number;
    unsettled: number;
    upset:     number;
  };
}

export interface ObservationMetrics {
  overall_mastery_pct: number;
  by_domain:           DomainMastery[];
  recently_observed:   number;  // observations in last 7 days
}

export interface DomainMastery {
  domain_name:  string;
  domain_code:  string;
  mastery_pct:  number;
  total_obs:    number;
}

export interface TransportMetrics {
  active_routes:       number;
  trips_today:         number;
  trips_in_progress:   number;
  students_on_transport: number;
  expiry_alerts:       number;
}

// ── Full dashboard response ───────────────────────────────────────────────────

export interface DashboardResponse {
  generated_at:   string;
  academic_year:  string | null;
  students:       StudentMetrics;
  attendance:     AttendanceMetrics;
  fees:           FeeMetrics;
  staff:          StaffMetrics;
  communication:  CommunicationMetrics;
  journals:       JournalMetrics;
  observations:   ObservationMetrics;
  transport:      TransportMetrics;
}
