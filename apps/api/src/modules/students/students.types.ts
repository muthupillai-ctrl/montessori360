// ── Database row shapes ───────────────────────────────────────────────────────

export interface StudentRow {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  dob: Date;
  gender: 'male' | 'female' | 'other' | null;
  class_id: string | null;
  profile_photo: string | null;
  blood_group: string | null;
  nationality: string;
  mother_tongue: string | null;
  aadhar_no: string | null;
  medical_notes: MedicalNotes;
  dietary_notes: string | null;
  allergies: string[];
  previous_school: string | null;
  admission_date: Date;
  sibling_ids: string[];
  transport_route_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  class_name?: string;
  emergency_mobile?: string | null;
  emergency_first_name?: string | null;
  emergency_last_name?: string | null;
  emergency_relation?: string | null;
}

export interface ClassRow {
  id: string;
  name: string;
  age_group_min: number | null;
  age_group_max: number | null;
  teacher_id: string | null;
  capacity: number;
  room_number: string | null;
  is_active: boolean;
  // Joined
  teacher_name?: string;
  enrolled_count?: number;
}

export interface MedicalNotes {
  conditions?: string[];
  medications?: string[];
  doctor_name?: string;
  doctor_phone?: string;
  notes?: string;
}

// ── Request / response DTOs ───────────────────────────────────────────────────

export interface ParentDto {
  relation:             'father' | 'mother' | 'guardian' | 'step_father' | 'step_mother' | 'other';
  first_name:           string;
  last_name:            string;
  mobile:               string;
  email?:               string;
  mobile_alt?:          string;
  is_primary?:          boolean;
  is_emergency_contact?: boolean;
  address_line1?:       string;
  address_line2?:       string;
  city?:                string;
  state?:               string;
  country?:             string;
  pincode?:             string;
}

export interface CreateStudentDto {
  first_name: string;
  last_name: string;
  dob: string;                        // ISO date string
  gender?: 'male' | 'female' | 'other';
  class_id?: string;
  blood_group?: string;
  nationality?: string;
  mother_tongue?: string;
  aadhar_no?: string;
  parents?: ParentDto[];
  medical_notes?: MedicalNotes;
  dietary_notes?: string;
  allergies?: string[];
  previous_school?: string;
  admission_date?: string;
  transport_route_id?: string;
}

export interface UpdateStudentDto extends Partial<CreateStudentDto> {}

export interface StudentFilters {
  class_id?: string;
  is_active?: boolean;
  no_class?: boolean;
  search?: string;
  rfid_uid?: string;
  page?: number;
  limit?: number;
}

export interface LinkSiblingsDto {
  student_id_a: string;
  student_id_b: string;
}

export interface AssignClassDto {
  class_id: string;
}
