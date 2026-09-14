import { tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateWorksheetHTML } from '../../services/ai.service.js';
import type {
  WorksheetRow, WorksheetLevel,
  CreateWorksheetDto, UpdateWorksheetDto, WorksheetFilters,
} from './worksheets.types.js';

function inferLevel(gradeLevel: string): WorksheetLevel | null {
  const gl = gradeLevel.toLowerCase();
  if (/montessori|casa|lkg|ukg|\bkg\b|nursery|kindergarten|pre.?school|pre.?primary/.test(gl)) return 'montessori';
  const num = parseInt(gl.match(/\d+/)?.[0] ?? '');
  if (!isNaN(num) && num >= 1 && num <= 5)  return 'primary';
  if (!isNaN(num) && num >= 6 && num <= 12) return 'high_school';
  return null;
}

class WorksheetsService {

  async list(schema: string, filters: WorksheetFilters): Promise<WorksheetRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (filters.subject)     { conditions.push(`subject = $${i++}`);       params.push(filters.subject); }
    if (filters.grade_level) { conditions.push(`grade_level = $${i++}`);   params.push(filters.grade_level); }
    if (filters.level)       { conditions.push(`level = $${i++}`);          params.push(filters.level); }
    if (filters.is_published !== undefined) {
      conditions.push(`is_published = $${i++}`);
      params.push(filters.is_published === 'true');
    }
    if (filters.search) {
      conditions.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
      params.push(`%${filters.search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return tenantQuery<WorksheetRow>(schema, `SELECT * FROM worksheets ${where} ORDER BY created_at DESC`, params);
  }

  async getById(schema: string, id: string): Promise<WorksheetRow> {
    const [row] = await tenantQuery<WorksheetRow>(schema, `SELECT * FROM worksheets WHERE id = $1`, [id]);
    if (!row) throw AppError.notFound('Worksheet');
    return row;
  }

  async create(schema: string, dto: CreateWorksheetDto, createdBy: string): Promise<WorksheetRow> {
    const level = dto.level ?? (dto.grade_level ? inferLevel(dto.grade_level) : null);
    const source = 'upload';
    const [row] = await tenantQuery<WorksheetRow>(
      schema,
      `INSERT INTO worksheets (title, description, subject, grade_level, level, file_url, content_html, source, is_published, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [dto.title, dto.description ?? null, dto.subject ?? null, dto.grade_level ?? null,
       level, dto.file_url ?? null, dto.content_html ?? null, source, dto.is_published ?? false, createdBy]
    );
    return row;
  }

  async update(schema: string, id: string, dto: UpdateWorksheetDto): Promise<WorksheetRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const cols: (keyof UpdateWorksheetDto)[] = ['title', 'description', 'subject', 'grade_level', 'level', 'content_html', 'is_published'];
    for (const col of cols) {
      if (dto[col] !== undefined) { fields.push(`${col} = $${i++}`); values.push(dto[col]); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);

    const [row] = await tenantQuery<WorksheetRow>(
      schema, `UPDATE worksheets SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    if (!row) throw AppError.notFound('Worksheet');
    return row;
  }

  async delete(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(schema, `DELETE FROM worksheets WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Worksheet');
  }

  async generate(
    schema: string,
    input: {
      subject: string; grade_level: string; level?: WorksheetLevel; topic: string;
      activity_type?: string; difficulty?: 'easy'|'medium'|'hard'; num_questions?: number;
      title?: string; description?: string; is_published?: boolean;
    },
    createdBy: string,
  ): Promise<WorksheetRow> {
    if (!process.env['ANTHROPIC_API_KEY']) throw AppError.badRequest('ANTHROPIC_API_KEY is not configured');
    const html  = await generateWorksheetHTML({ ...input, tenantSchema: schema });
    const title = input.title ?? `${input.topic} — ${input.subject} (${input.grade_level})`;
    const level = input.level ?? inferLevel(input.grade_level);
    const [row] = await tenantQuery<WorksheetRow>(
      schema,
      `INSERT INTO worksheets
         (title, description, subject, grade_level, level, content_html, source, is_published, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'generated',$7,$8) RETURNING *`,
      [title, input.description ?? null, input.subject, input.grade_level,
       level, html, input.is_published ?? false, createdBy],
    );
    return row;
  }
}

export const worksheetsService = new WorksheetsService();
