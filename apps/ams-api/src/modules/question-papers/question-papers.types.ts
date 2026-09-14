export interface QuestionPaperRow {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  topic: string | null;
  total_marks: number | null;
  duration_minutes: number | null;
  difficulty_distribution: string | null;
  question_types: string[] | null;
  content_html: string | null;
  source: 'manual' | 'generated';
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateQuestionPaperDto {
  title: string;
  subject?: string;
  grade_level?: string;
  topic?: string;
  total_marks?: number;
  duration_minutes?: number;
  difficulty_distribution?: string;
  question_types?: string[];
  content_html?: string;
  is_published?: boolean;
}

export interface UpdateQuestionPaperDto extends Partial<CreateQuestionPaperDto> {}

export interface GenerateQuestionPaperDto {
  subject: string;
  grade_level: string;
  topic: string;
  total_marks?: number;
  duration_minutes?: number;
  difficulty_distribution?: string;
  question_types?: string[];
  title?: string;
  is_published?: boolean;
}

export interface QuestionPaperFilters {
  subject?: string;
  grade_level?: string;
  is_published?: string;
  search?: string;
}
