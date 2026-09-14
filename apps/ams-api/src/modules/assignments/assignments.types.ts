export type ContentType = 'worksheet' | 'lesson_plan' | 'question_paper' | 'curriculum_area';

export interface AssignmentRow {
  id: string;
  content_type: ContentType;
  content_id: string;
  content_title: string;
  class_id: string | null;
  class_name: string | null;
  student_id: string | null;
  student_name: string | null;
  due_date: string | null;
  assigned_by: string | null;
  assigned_at: string;
}

export interface CreateAssignmentDto {
  content_type: ContentType;
  content_id: string;
  content_title: string;
  class_id?: string;
  class_name?: string;
  student_id?: string;
  student_name?: string;
  due_date?: string;
}

export interface AssignmentFilters {
  content_type?: string;
  class_id?: string;
  from_date?: string;
  to_date?: string;
}
