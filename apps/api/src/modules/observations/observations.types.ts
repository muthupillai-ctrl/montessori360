export type MilestoneGrade = 'not_started' | 'in_progress' | 'led' | 'mastered';

export type StandardDomain =
  | 'practical_life'
  | 'language'
  | 'cultural'
  | 'mathematics'
  | 'social_emotional';

// ── DB rows ───────────────────────────────────────────────────────────────────

export interface DomainRow {
  id:          string;
  name:        string;
  code:        string;         // e.g. "practical_life", "custom_123"
  is_standard: boolean;
  description: string | null;
  sort_order:  number;
  is_active:   boolean;
  created_at:  Date;
}

export interface MilestoneRow {
  id:          string;
  domain_id:   string;
  code:        string;         // e.g. "PL-001"
  name:        string;
  description: string | null;
  age_min:     number | null;  // months
  age_max:     number | null;  // months
  sort_order:  number;
  is_active:   boolean;
  created_at:  Date;
  // Joined
  domain_name?: string;
  domain_code?: string;
}

export interface ObservationRow {
  id:           string;
  student_id:   string;
  milestone_id: string;
  domain_id:    string;
  grade:        MilestoneGrade;
  notes:        string | null;
  observed_by:  string;
  observed_on:  Date;
  created_at:   Date;
  updated_at:   Date;
  // Joined
  student_name?:   string;
  admission_no?:   string;
  milestone_name?: string;
  milestone_code?: string;
  domain_name?:    string;
  domain_code?:    string;
  observer_name?:  string;
}

export interface StudentProgressSummary {
  domain_id:    string;
  domain_name:  string;
  domain_code:  string;
  total:        number;
  not_started:  number;
  in_progress:  number;
  led:          number;
  mastered:     number;
  percentage:   number;         // mastered / total * 100
  milestones:   MilestoneProgress[];
}

export interface MilestoneProgress {
  milestone_id:   string;
  milestone_code: string;
  milestone_name: string;
  grade:          MilestoneGrade | null;  // null = not yet observed
  notes:          string | null;
  observed_on:    Date | null;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateDomainDto {
  name:        string;
  code:        string;
  description?: string;
  sort_order?:  number;
}

export interface CreateMilestoneDto {
  domain_id:    string;
  code:         string;
  name:         string;
  description?: string;
  age_min?:     number;
  age_max?:     number;
  sort_order?:  number;
}

export interface RecordObservationDto {
  student_id:   string;
  milestone_id: string;
  grade:        MilestoneGrade;
  notes?:       string;
  observed_on?: string;   // ISO date, defaults to today
}

export interface BulkObservationDto {
  student_id:   string;
  observed_on?: string;
  observations: {
    milestone_id: string;
    grade:        MilestoneGrade;
    notes?:       string;
  }[];
}

export interface ObservationFilters {
  student_id?:  string;
  domain_id?:   string;
  grade?:       MilestoneGrade;
  date_from?:   string;
  date_to?:     string;
  page?:        number;
  limit?:       number;
}
