export type MoodIndicator  = 'happy' | 'calm' | 'unsettled' | 'upset';
export type MealQuantity   = 'well' | 'partial' | 'refused';
export type ActivityType   =
  | 'free_play' | 'circle_time' | 'outdoor' | 'art_craft'
  | 'music' | 'story_time' | 'montessori_work' | 'sensorial'
  | 'practical_life' | 'language' | 'math' | 'cultural' | 'other';

// ── Sub-structures ────────────────────────────────────────────────────────────

export interface MealLog {
  breakfast?: MealQuantity;
  lunch?:     MealQuantity;
  snack?:     MealQuantity;
  notes?:     string;
}

export interface NapLog {
  start_time?: string;   // HH:MM
  end_time?:   string;   // HH:MM
  quality?:    'good' | 'poor' | 'none';
  notes?:      string;
}

export interface ToiletLog {
  count:  number;
  notes?: string;
}

export interface ActivityEntry {
  type:        ActivityType;
  description: string;
  duration_mins?: number;
}

export interface HomeworkEntry {
  subject:     string;
  description: string;
  completed:   boolean;
}

// ── DB row ────────────────────────────────────────────────────────────────────

export interface JournalRow {
  id:           string;
  student_id:   string;
  journal_date: Date;
  meal:         MealLog;
  nap:          NapLog;
  toilet:       ToiletLog;
  activities:   ActivityEntry[];
  mood:         MoodIndicator | null;
  mood_note:    string | null;
  homework:     HomeworkEntry[];
  teacher_note: string | null;
  published_at: Date | null;
  created_by:   string | null;
  created_at:   Date;
  updated_at:   Date;
  // Joined
  student_name?: string;
  admission_no?: string;
  class_name?:   string;
  author_name?:  string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateJournalDto {
  student_id:    string;
  journal_date?: string;        // ISO date, defaults to today
  meal?:         MealLog;
  nap?:          NapLog;
  toilet?:       ToiletLog;
  activities?:   ActivityEntry[];
  mood?:         MoodIndicator;
  mood_note?:    string;
  homework?:     HomeworkEntry[];
  teacher_note?: string;
  publish?:      boolean;       // publish immediately to parent
}

export interface UpdateJournalDto extends Partial<Omit<CreateJournalDto, 'student_id' | 'journal_date'>> {}

export interface JournalFilters {
  student_id?:  string;
  class_id?:    string;
  date?:        string;
  date_from?:   string;
  date_to?:     string;
  published?:   boolean;
  page?:        number;
  limit?:       number;
}
