import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { PoolClient } from 'pg';

export interface CreateHomeworkDto {
  title:       string;
  description?: string;
  subject?:    string;
  class_id?:   string;
  student_id?: string;
  due_date:    string;
  publish_now?: boolean;
}

class HomeworkService {

  async list(schema: string, filters: { class_id?: string; student_id?: string; published?: boolean }): Promise<unknown[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (filters.class_id)   { conditions.push(`ht.class_id = $${i++}`);   params.push(filters.class_id); }
    if (filters.student_id) { conditions.push(`ht.student_id = $${i++}`); params.push(filters.student_id); }
    if (filters.published !== undefined) {
      conditions.push(`ht.is_published = $${i++}`);
      params.push(filters.published);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return tenantQuery(
      schema,
      `SELECT ht.*,
              to_char(ht.due_date, 'YYYY-MM-DD') AS due_date,
              c.name   AS class_name,
              CONCAT(s.first_name,' ',s.last_name)  AS assigned_by_name,
              CONCAT(st.first_name,' ',st.last_name) AS student_name
       FROM   homework_tasks ht
       LEFT   JOIN classes c  ON c.id  = ht.class_id
       LEFT   JOIN staff s    ON s.id  = ht.assigned_by
       LEFT   JOIN students st ON st.id = ht.student_id
       ${where}
       ORDER  BY ht.due_date DESC, ht.created_at DESC`,
      params
    );
  }

  async create(schema: string, dto: CreateHomeworkDto, staffId: string): Promise<unknown> {
    if (!dto.class_id && !dto.student_id)
      throw AppError.badRequest('Either class_id or student_id is required');

    return tenantTransaction(schema, async (client: PoolClient) => {
      const publishedAt = dto.publish_now ? 'now()' : 'NULL';
      const result = await client.query(
        `INSERT INTO ${schema}.homework_tasks
           (title, description, subject, class_id, student_id, due_date, assigned_by, is_published, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${publishedAt})
         RETURNING *`,
        [dto.title, dto.description ?? null, dto.subject ?? null,
         dto.class_id ?? null, dto.student_id ?? null, dto.due_date,
         staffId, dto.publish_now ?? false]
      );
      return result.rows[0];
    });
  }

  async publish(schema: string, id: string): Promise<unknown> {
    const [row] = await tenantQuery(
      schema,
      `UPDATE homework_tasks SET is_published = true, published_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!row) throw AppError.notFound('Homework task');
    return row;
  }

  async update(schema: string, id: string, dto: Partial<CreateHomeworkDto>): Promise<unknown> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (dto.title       !== undefined) { sets.push(`title=$${i++}`);       params.push(dto.title); }
    if (dto.description !== undefined) { sets.push(`description=$${i++}`); params.push(dto.description); }
    if (dto.subject     !== undefined) { sets.push(`subject=$${i++}`);     params.push(dto.subject); }
    if (dto.due_date    !== undefined) { sets.push(`due_date=$${i++}`);    params.push(dto.due_date); }
    if (!sets.length) throw AppError.badRequest('Nothing to update');
    sets.push(`updated_at=now()`);
    params.push(id);

    const [row] = await tenantQuery(
      schema,
      `UPDATE homework_tasks SET ${sets.join(',')} WHERE id=$${i} RETURNING *`,
      params
    );
    if (!row) throw AppError.notFound('Homework task');
    return row;
  }

  async delete(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(schema, `DELETE FROM homework_tasks WHERE id=$1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Homework task');
  }
}

export const homeworkService = new HomeworkService();
