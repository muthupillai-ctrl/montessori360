export type WorksheetLevel = 'montessori' | 'primary' | 'high_school';

export interface WorksheetRow {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  grade_level: string | null;
  level: WorksheetLevel | null;
  file_url: string | null;
  content_html: string | null;
  source: 'upload' | 'generated';
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorksheetDto {
  title: string;
  description?: string;
  subject?: string;
  grade_level?: string;
  level?: WorksheetLevel;
  file_url?: string;
  content_html?: string;
  is_published?: boolean;
}

export interface UpdateWorksheetDto extends Partial<CreateWorksheetDto> {}

export interface WorksheetFilters {
  subject?: string;
  grade_level?: string;
  level?: string;
  is_published?: string;
  search?: string;
}
