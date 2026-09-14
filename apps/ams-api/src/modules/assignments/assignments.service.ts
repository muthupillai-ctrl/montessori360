import { tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { AssignmentRow, CreateAssignmentDto, AssignmentFilters } from './assignments.types.js';

class AssignmentsService {

  async list(schema: string, filters: AssignmentFilters): Promise<AssignmentRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (filters.content_type) { conditions.push(`content_type = $${i++}`); params.push(filters.content_type); }
    if (filters.class_id)     { conditions.push(`class_id = $${i++}`);     params.push(filters.class_id); }
    if (filters.from_date)    { conditions.push(`due_date >= $${i++}`);    params.push(filters.from_date); }
    if (filters.to_date)      { conditions.push(`due_date <= $${i++}`);    params.push(filters.to_date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return tenantQuery<AssignmentRow>(
      schema,
      `SELECT * FROM assignments ${where} ORDER BY assigned_at DESC`,
      params
    );
  }

  async create(schema: string, dto: CreateAssignmentDto, assignedBy: string): Promise<AssignmentRow> {
    const [row] = await tenantQuery<AssignmentRow>(
      schema,
      `INSERT INTO assignments
         (content_type, content_id, content_title, class_id, class_name, student_id, student_name, due_date, assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [dto.content_type, dto.content_id, dto.content_title,
       dto.class_id ?? null, dto.class_name ?? null,
       dto.student_id ?? null, dto.student_name ?? null,
       dto.due_date ?? null, assignedBy]
    );
    return row;
  }

  async delete(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(schema, `DELETE FROM assignments WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Assignment');
  }
}

export const assignmentsService = new AssignmentsService();
