import { tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { generateQuestionPaperHTML } from '../../services/ai.service.js';
import type {
  QuestionPaperRow, CreateQuestionPaperDto, UpdateQuestionPaperDto,
  GenerateQuestionPaperDto, QuestionPaperFilters,
} from './question-papers.types.js';

class QuestionPapersService {

  async list(schema: string, filters: QuestionPaperFilters): Promise<QuestionPaperRow[]> {
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
    return tenantQuery<QuestionPaperRow>(schema,
      `SELECT * FROM question_papers ${where} ORDER BY created_at DESC`, params);
  }

  async getById(schema: string, id: string): Promise<QuestionPaperRow> {
    const [row] = await tenantQuery<QuestionPaperRow>(schema,
      `SELECT * FROM question_papers WHERE id = $1`, [id]);
    if (!row) throw AppError.notFound('Question paper');
    return row;
  }

  async create(schema: string, dto: CreateQuestionPaperDto, createdBy: string): Promise<QuestionPaperRow> {
    const [row] = await tenantQuery<QuestionPaperRow>(schema, `
      INSERT INTO question_papers
        (title, subject, grade_level, topic, total_marks, duration_minutes,
         difficulty_distribution, question_types, content_html, is_published, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [dto.title, dto.subject ?? null, dto.grade_level ?? null, dto.topic ?? null,
       dto.total_marks ?? null, dto.duration_minutes ?? null,
       dto.difficulty_distribution ?? null, dto.question_types ?? null,
       dto.content_html ?? null, dto.is_published ?? false, createdBy]);
    return row;
  }

  async update(schema: string, id: string, dto: UpdateQuestionPaperDto): Promise<QuestionPaperRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const cols: (keyof UpdateQuestionPaperDto)[] = [
      'title','subject','grade_level','topic','total_marks','duration_minutes',
      'difficulty_distribution','question_types','content_html','is_published',
    ];
    for (const col of cols) {
      if (dto[col] !== undefined) { fields.push(`${col} = $${i++}`); values.push(dto[col]); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);
    const [row] = await tenantQuery<QuestionPaperRow>(schema,
      `UPDATE question_papers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!row) throw AppError.notFound('Question paper');
    return row;
  }

  async delete(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(schema,
      `DELETE FROM question_papers WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Question paper');
  }

  async generate(schema: string, dto: GenerateQuestionPaperDto, createdBy: string): Promise<QuestionPaperRow> {
    if (!process.env['ANTHROPIC_API_KEY']) throw AppError.badRequest('ANTHROPIC_API_KEY is not configured');
    const html = await generateQuestionPaperHTML({ ...dto, tenantSchema: schema });
    const title = dto.title ?? `${dto.topic} — ${dto.subject} (${dto.grade_level})`;
    const [row] = await tenantQuery<QuestionPaperRow>(schema, `
      INSERT INTO question_papers
        (title, subject, grade_level, topic, total_marks, duration_minutes,
         difficulty_distribution, question_types, content_html, source, is_published, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'generated',$10,$11) RETURNING *`,
      [title, dto.subject, dto.grade_level, dto.topic,
       dto.total_marks ?? null, dto.duration_minutes ?? null,
       dto.difficulty_distribution ?? null, dto.question_types ?? null,
       html, dto.is_published ?? false, createdBy]);
    return row;
  }
}

export const questionPapersService = new QuestionPapersService();
