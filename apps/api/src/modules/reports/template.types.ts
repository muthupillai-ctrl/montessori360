export type FontChoice = 'helvetica' | 'times' | 'courier';

export type SectionKey =
  | 'cover'
  | 'attendance'
  | 'mood'
  | 'domain_progress'
  | 'teacher_note'
  | 'homework_summary'
  | 'photo_collage';

export interface SectionConfig {
  key:     SectionKey;
  enabled: boolean;
  order:   number;
  label?:  string;   // override display label
}

export interface ReportTemplateRow {
  id:              string;
  name:            string;
  description:     string | null;
  logo_url:        string | null;
  primary_colour:  string;    // hex e.g. "#1F3864"
  secondary_colour: string;   // hex
  accent_colour:   string;    // hex
  font:            FontChoice;
  sections:        SectionConfig[];
  is_default:      boolean;   // school-wide default
  is_active:       boolean;
  created_by:      string | null;
  created_at:      Date;
  updated_at:      Date;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateTemplateDto {
  name:             string;
  description?:     string;
  logo_url?:        string;
  primary_colour?:  string;
  secondary_colour?: string;
  accent_colour?:   string;
  font?:            FontChoice;
  sections?:        SectionConfig[];
  is_default?:      boolean;
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {}

export interface AssignTemplateDto {
  template_id: string;
}

// ── Default template config ────────────────────────────────────────────────────

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: 'cover',           enabled: true,  order: 1 },
  { key: 'attendance',      enabled: true,  order: 2 },
  { key: 'mood',            enabled: true,  order: 3 },
  { key: 'domain_progress', enabled: true,  order: 4 },
  { key: 'teacher_note',    enabled: true,  order: 5 },
  { key: 'homework_summary',enabled: false, order: 6 },
  { key: 'photo_collage',   enabled: false, order: 7 },
];

export const DEFAULT_TEMPLATE: Omit<ReportTemplateRow, 'id' | 'created_by' | 'created_at' | 'updated_at'> = {
  name:             'Default Template',
  description:      'Standard Montessori360 progress card',
  logo_url:         null,
  primary_colour:   '#1F3864',
  secondary_colour: '#2E5AA8',
  accent_colour:    '#D6E4F0',
  font:             'helvetica',
  sections:         DEFAULT_SECTIONS,
  is_default:       true,
  is_active:        true,
};
