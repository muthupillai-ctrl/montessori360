import { tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateLessonPlanHTML } from '../../services/ai.service.js';
import type {
  LessonPlanRow, CreateLessonPlanDto, UpdateLessonPlanDto,
  GenerateLessonPlanDto, LessonPlanFilters,
} from './lesson-plans.types.js';

class LessonPlansService {

  async list(schema: string, filters: LessonPlanFilters): Promise<LessonPlanRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (filters.subject)     { conditions.push(`subject = $${i++}`);     params.push(filters.subject); }
    if (filters.grade_level) { conditions.push(`grade_level = $${i++}`); params.push(filters.grade_level); }
    if (filters.is_published !== undefined) {
      conditions.push(`is_published = $${i++}`);
      params.push(filters.is_published === 'true');
    }
    if (filters.search) {
      conditions.push(`(title ILIKE $${i} OR topic ILIKE $${i})`);
      params.push(`%${filters.search}%`); i++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return tenantQuery<LessonPlanRow>(schema,
      `SELECT * FROM lesson_plans ${where} ORDER BY created_at DESC`, params);
  }

  async getById(schema: string, id: string): Promise<LessonPlanRow> {
    const [row] = await tenantQuery<LessonPlanRow>(schema,
      `SELECT * FROM lesson_plans WHERE id = $1`, [id]);
    if (!row) throw AppError.notFound('Lesson plan');
    return row;
  }

  async create(schema: string, dto: CreateLessonPlanDto, createdBy: string): Promise<LessonPlanRow> {
    const [row] = await tenantQuery<LessonPlanRow>(schema, `
      INSERT INTO lesson_plans
        (title, subject, grade_level, topic, duration_minutes, learning_objectives, content_html, is_published, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [dto.title, dto.subject ?? null, dto.grade_level ?? null, dto.topic ?? null,
       dto.duration_minutes ?? null, dto.learning_objectives ?? null,
       dto.content_html ?? null, dto.is_published ?? false, createdBy]);
    return row;
  }

  async update(schema: string, id: string, dto: UpdateLessonPlanDto): Promise<LessonPlanRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const cols: (keyof UpdateLessonPlanDto)[] = [
      'title','subject','grade_level','topic','duration_minutes',
      'learning_objectives','content_html','is_published',
    ];
    for (const col of cols) {
      if (dto[col] !== undefined) { fields.push(`${col} = $${i++}`); values.push(dto[col]); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);
    const [row] = await tenantQuery<LessonPlanRow>(schema,
      `UPDATE lesson_plans SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!row) throw AppError.notFound('Lesson plan');
    return row;
  }

  async delete(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(schema,
      `DELETE FROM lesson_plans WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Lesson plan');
  }

  async generate(schema: string, dto: GenerateLessonPlanDto, createdBy: string): Promise<LessonPlanRow> {
    if (!process.env['ANTHROPIC_API_KEY']) throw AppError.badRequest('ANTHROPIC_API_KEY is not configured');
    const html = await generateLessonPlanHTML({ ...dto, tenantSchema: schema });
    const title = dto.title ?? `${dto.topic} — ${dto.subject} (${dto.grade_level})`;
    const [row] = await tenantQuery<LessonPlanRow>(schema, `
      INSERT INTO lesson_plans
        (title, subject, grade_level, topic, duration_minutes, learning_objectives,
         content_html, source, is_published, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'generated',$8,$9) RETURNING *`,
      [title, dto.subject, dto.grade_level, dto.topic,
       dto.duration_minutes ?? null, dto.learning_objectives ?? null,
       html, dto.is_published ?? false, createdBy]);
    return row;
  }
}

export const lessonPlansService = new LessonPlansService();
