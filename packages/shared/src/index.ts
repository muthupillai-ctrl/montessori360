// ── User roles ────────────────────────────────────────────────────────────────
export const ROLES = {
  OWNER:             'owner',
  PRINCIPAL:         'principal',
  TEACHER:           'teacher',
  ASSISTANT_TEACHER: 'assistant_teacher',
  ACCOUNTANT:        'accountant',
  DRIVER:            'driver',
  SUPPORT:           'support',
  PARENT:            'parent',
  PLATFORM_ADMIN:    'platform_admin',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ── Attendance status ─────────────────────────────────────────────────────────
export const ATTENDANCE_STATUS = {
  PRESENT:  'present',
  ABSENT:   'absent',
  LATE:     'late',
  HALF_DAY: 'half_day',
  HOLIDAY:  'holiday',
} as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];

// ── Fee invoice status ────────────────────────────────────────────────────────
export const INVOICE_STATUS = {
  PENDING:  'pending',
  PAID:     'paid',
  PARTIAL:  'partial',
  OVERDUE:  'overdue',
  WAIVED:   'waived',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

// ── Subscription plans ────────────────────────────────────────────────────────
export const PLAN_NAMES = ['starter', 'growth', 'enterprise'] as const;
export type PlanName = typeof PLAN_NAMES[number];

// ── Pagination ────────────────────────────────────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── API response wrappers ─────────────────────────────────────────────────────
export interface ApiSuccess<T = unknown> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ── Domain types ──────────────────────────────────────────────────────────────
export interface EmergencyContact {
  name:       string;
  relation:   string;
  phone:      string;
  email?:     string;   // used for parent portal login
  is_primary: boolean;
}

export interface FeeHead {
  name: string;
  amount: number;
  is_optional: boolean;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}
