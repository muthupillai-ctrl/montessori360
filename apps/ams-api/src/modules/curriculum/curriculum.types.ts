export interface AreaRow {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sequence: number;
  activity_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: string;
  area_id: string;
  name: string;
  description: string | null;
  material_name: string | null;
  sequence: number;
  level: 'casa' | 'lower_el' | 'upper_el';
  prerequisite_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressRow {
  id: string;
  student_id: string;
  activity_id: string;
  status: 'not_started' | 'introduced' | 'practicing' | 'mastered';
  notes: string | null;
  introduced_at: string | null;
  practiced_at: string | null;
  mastered_at: string | null;
  updated_by: string | null;
  updated_at: string;
  // joined
  activity_name?: string;
  area_id?: string;
  area_name?: string;
  area_icon?: string;
  area_color?: string;
  activity_sequence?: number;
  area_sequence?: number;
}

export interface CreateAreaDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sequence?: number;
}
export interface UpdateAreaDto extends Partial<CreateAreaDto> {}

export interface CreateActivityDto {
  name: string;
  description?: string;
  material_name?: string;
  sequence?: number;
  level?: 'casa' | 'lower_el' | 'upper_el';
  prerequisite_id?: string | null;
}
export interface UpdateActivityDto extends Partial<CreateActivityDto> {}

export interface UpsertProgressDto {
  status: 'not_started' | 'introduced' | 'practicing' | 'mastered';
  notes?: string;
}
