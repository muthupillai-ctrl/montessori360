export interface PromotionBatchRow {
  id: string;
  from_academic_year_id: string;
  to_academic_year_id: string;
  class_mapping: ClassMappingEntry[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_students: number;
  promoted_count: number;
  graduated_count: number;
  skipped_count: number;
  errors: PromotionError[];
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  // joined
  from_year_name?: string;
  to_year_name?: string;
  created_by_name?: string;
}

export interface StudentEnrollmentRow {
  id: string;
  student_id: string;
  academic_year_id: string;
  class_id: string;
  promoted_from_class_id: string | null;
  promoted_at: string | null;
  created_at: string;
  // joined
  academic_year_name?: string;
  class_name?: string;
  section?: string | null;
  from_class_name?: string | null;
}

export interface ClassMappingEntry {
  from_class_id: string;
  to_class_id: string | null; // null = graduate (remove from school)
}

export interface PromotionError {
  student_id: string;
  student_name: string;
  reason: string;
}

export interface PreparePromotionDto {
  from_academic_year_id: string;
  to_academic_year_id: string;
  class_mapping: ClassMappingEntry[];
}

export interface ExecutePromotionDto extends PreparePromotionDto {
  confirmed: true;
}

export interface ClassPromotionPreview {
  from_class_id: string;
  from_class_name: string;
  to_class_id: string | null;
  to_class_name: string | null;
  student_count: number;
  warnings: string[];
  students: StudentPreviewRow[];
}

export interface StudentPreviewRow {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  outstanding_fees: number;
  warnings: string[];
}

export interface PromotionPreview {
  from_year: string;
  to_year: string;
  total_students: number;
  classes: ClassPromotionPreview[];
  global_warnings: string[];
}
