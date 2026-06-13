export type EventType =
  | 'holiday'
  | 'exam'
  | 'event'
  | 'meeting'
  | 'excursion'
  | 'closure'
  | 'term_start'
  | 'term_end'
  | 'other';

export type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'yearly';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun

// ── DB rows ───────────────────────────────────────────────────────────────────

export interface AcademicYearRow {
  id:           string;
  name:         string;       // e.g. "2025-2026"
  start_date:   Date;
  end_date:     Date;
  is_current:   boolean;
  working_days: DayOfWeek[];  // e.g. [1,2,3,4,5] = Mon-Fri
  created_at:   Date;
  updated_at:   Date;
}

export interface TermRow {
  id:             string;
  academic_year_id: string;
  name:           string;     // e.g. "Term 1"
  start_date:     Date;
  end_date:       Date;
  sort_order:     number;
  created_at:     Date;
  // Joined
  academic_year_name?: string;
}

export interface CalendarEventRow {
  id:           string;
  title:        string;
  description:  string | null;
  event_type:   EventType;
  start_date:   Date;
  end_date:     Date;
  is_all_day:   boolean;
  start_time:   string | null;  // HH:MM
  end_time:     string | null;  // HH:MM
  affects_attendance: boolean;  // if true, marks students absent
  class_ids:    string[];       // empty = all classes
  recurrence:   RecurrenceType;
  colour:       string;         // hex
  created_by:   string | null;
  created_at:   Date;
  updated_at:   Date;
  // Joined
  author_name?: string;
}

export interface TimetableSlotRow {
  id:         string;
  class_id:   string;
  day_of_week: DayOfWeek;
  start_time: string;   // HH:MM
  end_time:   string;   // HH:MM
  subject:    string;
  teacher_id: string | null;
  room:       string | null;
  created_at: Date;
  // Joined
  teacher_name?: string;
  class_name?:   string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateAcademicYearDto {
  name:          string;
  start_date:    string;
  end_date:      string;
  working_days?: DayOfWeek[];
  is_current?:   boolean;
}

export interface CreateTermDto {
  academic_year_id: string;
  name:             string;
  start_date:       string;
  end_date:         string;
  sort_order?:      number;
}

export interface CreateEventDto {
  title:              string;
  description?:       string;
  event_type:         EventType;
  start_date:         string;
  end_date:           string;
  is_all_day?:        boolean;
  start_time?:        string;
  end_time?:          string;
  affects_attendance?: boolean;
  class_ids?:         string[];
  recurrence?:        RecurrenceType;
  colour?:            string;
}

export interface CreateTimetableSlotDto {
  class_id:    string;
  day_of_week: DayOfWeek;
  start_time:  string;
  end_time:    string;
  subject:     string;
  teacher_id?: string;
  room?:       string;
}

export interface CalendarFilters {
  from?:        string;
  to?:          string;
  event_type?:  EventType;
  class_id?:    string;
  academic_year_id?: string;
}

export interface WorkingDayResult {
  date:            string;
  is_working:      boolean;
  events:          CalendarEventRow[];
  is_holiday:      boolean;
}
