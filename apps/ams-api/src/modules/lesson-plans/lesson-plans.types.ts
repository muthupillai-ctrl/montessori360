export interface LessonPlanRow {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  topic: string | null;
  duration_minutes: number | null;
  learning_objectives: string | null;
  content_html: string | null;
  source: 'manual' | 'generated';
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLessonPlanDto {
  title: string;
  subject?: string;
  grade_level?: string;
  topic?: string;
  duration_minutes?: number;
  learning_objectives?: string;
  content_html?: string;
  is_published?: boolean;
}

export interface UpdateLessonPlanDto extends Partial<CreateLessonPlanDto> {}

export interface GenerateLessonPlanDto {
  subject: string;
  grade_level: string;
  topic: string;
  duration_minutes?: number;
  learning_objectives?: string;
  title?: string;
  is_published?: boolean;
}

export interface LessonPlanFilters {
  subject?: string;
  grade_level?: string;
  is_published?: string;
  search?: string;
}
