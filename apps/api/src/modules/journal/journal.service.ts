import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { JournalRow, CreateJournalDto, UpdateJournalDto, JournalFilters } from './journal.types.js';
import type { PaginatedResponse } from '@montessori360/shared';

const CACHE_TTL = 300;

class JournalService {

  // ── Create ────────────────────────────────────────────────────────────────
  async create(schema: string, dto: CreateJournalDto, createdBy: string): Promise<JournalRow> {
    const journalDate = dto.journal_date ?? new Date().toISOString().slice(0, 10);

    return tenantTransaction(schema, async (client) => {
      // Verify student exists
      const { rows: [student] } = await client.query(
        `SELECT id FROM ${schema}.students WHERE id = $1 AND is_active = true`,
        [dto.student_id]
      );
      if (!student) throw AppError.notFound('Student');

      // One journal per student per day
      const { rows: [existing] } = await client.query(
        `SELECT id FROM ${schema}.daily_journals WHERE student_id = $1 AND journal_date = $2`,
        [dto.student_id, journalDate]
      );
      if (existing) throw AppError.conflict(`Journal already exists for this student on ${journalDate}. Use PUT to update.`);

      const publishedAt = dto.publish ? new Date() : null;

      const { rows } = await client.query(
        `INSERT INTO ${schema}.daily_journals
           (student_id, journal_date, meal, nap, toilet, activities,
            mood, mood_note, homework, teacher_note, published_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          dto.student_id, journalDate,
          JSON.stringify(dto.meal ?? {}),
          JSON.stringify(dto.nap ?? {}),
          JSON.stringify(dto.toilet ?? { count: 0 }),
          JSON.stringify(dto.activities ?? []),
          dto.mood ?? null,
          dto.mood_note ?? null,
          JSON.stringify(dto.homework ?? []),
          dto.teacher_note ?? null,
          publishedAt,
          createdBy,
        ]
      );

      await cacheDelPattern(`${schema}:journals:list:*`);
      return rows[0] as JournalRow;
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  async update(schema: string, id: string, dto: UpdateJournalDto, updatedBy: string): Promise<JournalRow> {
    const existing = await this.getById(schema, id);

    // Cannot edit a published journal (unless admin/principal)
    // Service leaves this enforcement to route-level role check

    return tenantTransaction(schema, async (client) => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      const jsonFields = ['meal', 'nap', 'toilet', 'activities', 'homework'] as const;
      const textFields = ['mood', 'mood_note', 'teacher_note'] as const;

      for (const f of jsonFields) {
        if (dto[f] !== undefined) {
          fields.push(`${f} = $${i++}`);
          values.push(JSON.stringify(dto[f]));
        }
      }
      for (const f of textFields) {
        if (dto[f] !== undefined) {
          fields.push(`${f} = $${i++}`);
          values.push(dto[f]);
        }
      }
      if (dto.publish === true && !existing.published_at) {
        fields.push(`published_at = now()`);
      }
      if (!fields.length) throw AppError.badRequest('No fields to update');

      fields.push(`updated_at = now()`);
      values.push(id);

      const { rows } = await client.query(
        `UPDATE ${schema}.daily_journals SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );

      await cacheDel(`${schema}:journals:${id}`);
      await cacheDelPattern(`${schema}:journals:list:*`);
      return rows[0] as JournalRow;
    });
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  async publish(schema: string, id: string): Promise<JournalRow> {
    const [row] = await tenantQuery<JournalRow>(
      schema,
      `UPDATE ${schema}.daily_journals
       SET published_at = now(), updated_at = now()
       WHERE id = $1 AND published_at IS NULL
       RETURNING *`,
      [id]
    );
    if (!row) throw AppError.badRequest('Journal not found or already published');
    await cacheDel(`${schema}:journals:${id}`);
    await cacheDelPattern(`${schema}:journals:list:*`);
    return row;
  }

  // ── Bulk publish (end of day — publish all unpublished for a class) ────────
  async bulkPublish(schema: string, classId: string, date?: string): Promise<number> {
    const journalDate = date ?? new Date().toISOString().slice(0, 10);
    const rows = await tenantQuery<{ id: string }>(
      schema,
      `UPDATE ${schema}.daily_journals j
       SET published_at = now(), updated_at = now()
       FROM ${schema}.students s
       WHERE j.student_id = s.id
         AND s.class_id = $1
         AND j.journal_date = $2
         AND j.published_at IS NULL
       RETURNING j.id`,
      [classId, journalDate]
    );
    await cacheDelPattern(`${schema}:journals:list:*`);
    return rows.length;
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────
  async getById(schema: string, id: string): Promise<JournalRow> {
    const cacheKey = `${schema}:journals:${id}`;
    const cached = await cacheGet<JournalRow>(cacheKey);
    if (cached) return cached;

    const [row] = await tenantQuery<JournalRow>(
      schema,
      `SELECT j.*,
              CONCAT(s.first_name, ' ', s.last_name)        AS student_name,
              s.admission_no,
              c.name                                         AS class_name,
              NULLIF(TRIM(CONCAT(st.first_name, ' ', st.last_name)), '') AS author_name
       FROM   ${schema}.daily_journals j
       JOIN   ${schema}.students s  ON s.id  = j.student_id
       LEFT JOIN ${schema}.classes c   ON c.id  = s.class_id
       LEFT JOIN ${schema}.staff st    ON st.id = j.created_by
       WHERE  j.id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('Journal');
    await cacheSet(cacheKey, row, CACHE_TTL);
    return row;
  }

  // ── Get by student + date ─────────────────────────────────────────────────
  async getByStudentAndDate(schema: string, studentId: string, date: string): Promise<JournalRow | null> {
    const [row] = await tenantQuery<JournalRow>(
      schema,
      `SELECT j.*,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.admission_no,
              c.name AS class_name
       FROM   ${schema}.daily_journals j
       JOIN   ${schema}.students s ON s.id = j.student_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       WHERE  j.student_id = $1 AND j.journal_date = $2`,
      [studentId, date]
    );
    return row ?? null;
  }

  // ── List ──────────────────────────────────────────────────────────────────
  async list(schema: string, filters: JournalFilters): Promise<PaginatedResponse<JournalRow>> {
    const { student_id, class_id, date, date_from, date_to, published, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const cacheKey = `${schema}:journals:list:${JSON.stringify(filters)}`;
    const cached = await cacheGet<PaginatedResponse<JournalRow>>(cacheKey);
    if (cached) return cached;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (student_id)       { conditions.push(`j.student_id = $${i++}`);          params.push(student_id); }
    if (class_id)         { conditions.push(`s.class_id = $${i++}`);            params.push(class_id); }
    if (date)             { conditions.push(`j.journal_date = $${i++}`);         params.push(date); }
    if (date_from)        { conditions.push(`j.journal_date >= $${i++}`);        params.push(date_from); }
    if (date_to)          { conditions.push(`j.journal_date <= $${i++}`);        params.push(date_to); }
    if (published === true)  { conditions.push(`j.published_at IS NOT NULL`); }
    if (published === false) { conditions.push(`j.published_at IS NULL`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total
       FROM ${schema}.daily_journals j
       JOIN ${schema}.students s ON s.id = j.student_id
       ${where}`,
      params
    );

    params.push(limit, offset);
    const rows = await tenantQuery<JournalRow>(
      schema,
      `SELECT j.*,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.admission_no,
              c.name AS class_name
       FROM   ${schema}.daily_journals j
       JOIN   ${schema}.students s ON s.id = j.student_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       ${where}
       ORDER  BY j.journal_date DESC, s.first_name
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    const result: PaginatedResponse<JournalRow> = {
      data: rows,
      meta: { total: parseInt(countRow.total), page, limit, totalPages: Math.ceil(parseInt(countRow.total) / limit) },
    };
    await cacheSet(cacheKey, result, CACHE_TTL);
    return result;
  }

  // ── Class daily overview (all students in a class for a given date) ────────

  async moodTrend(schema: string, studentId: string, days: number = 30): Promise<any[]> {
    return tenantQuery(
      schema,
      `SELECT
         journal_date::text   AS date,
         mood,
         teacher_note,
         published_at
       FROM   ${schema}.daily_journals
       WHERE  student_id = $1
         AND  journal_date >= CURRENT_DATE - ($2 || ' days')::interval
         AND  mood IS NOT NULL
       ORDER  BY journal_date`,
      [studentId, days]
    );
  }

  async schoolMoodSummary(schema: string, dateFrom: string, dateTo: string): Promise<any> {
    const [summary] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*)                                        AS total,
         COUNT(*) FILTER (WHERE mood = 'happy')          AS happy,
         COUNT(*) FILTER (WHERE mood = 'calm')           AS calm,
         COUNT(*) FILTER (WHERE mood = 'unsettled')      AS unsettled,
         COUNT(*) FILTER (WHERE mood = 'upset')          AS upset,
         COUNT(*) FILTER (WHERE published_at IS NOT NULL) AS published,
         COUNT(DISTINCT student_id)                      AS unique_students,
         COUNT(DISTINCT journal_date)                    AS days_covered
       FROM ${schema}.daily_journals
       WHERE journal_date BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    );

    const byDay = await tenantQuery<any>(
      schema,
      `SELECT
         journal_date::text                              AS date,
         COUNT(*)::int                                   AS total,
         COUNT(*) FILTER (WHERE mood = 'happy')::int    AS happy,
         COUNT(*) FILTER (WHERE mood = 'calm')::int     AS calm,
         COUNT(*) FILTER (WHERE mood = 'unsettled')::int AS unsettled,
         COUNT(*) FILTER (WHERE mood = 'upset')::int    AS upset
       FROM ${schema}.daily_journals
       WHERE journal_date BETWEEN $1 AND $2
       GROUP BY journal_date
       ORDER BY journal_date`,
      [dateFrom, dateTo]
    );

    return { summary, byDay };
  }

  async completionReport(schema: string, date: string): Promise<any[]> {
    return tenantQuery(
      schema,
      `SELECT
         c.id                                            AS class_id,
         c.name                                         AS class_name,
         COUNT(s.id)::int                               AS total_students,
         COUNT(j.id)::int                               AS journals_written,
         COUNT(j.id) FILTER (WHERE j.published_at IS NOT NULL)::int AS published,
         ROUND(COUNT(j.id) * 100.0 / NULLIF(COUNT(s.id), 0), 1) AS completion_pct
       FROM   ${schema}.classes c
       JOIN   ${schema}.students s  ON s.class_id = c.id AND s.is_active = true
       LEFT JOIN ${schema}.daily_journals j ON j.student_id = s.id AND j.journal_date = $1
       WHERE  c.is_active = true
       GROUP  BY c.id, c.name
       ORDER  BY c.name`,
      [date]
    );
  }

  async weeklyDigest(schema: string, studentId: string, weekStart: string): Promise<any[]> {
    return tenantQuery(
      schema,
      `SELECT
         j.journal_date::text AS date,
         j.mood,
         j.mood_note,
         j.teacher_note,
         j.meal,
         j.nap,
         j.toilet,
         j.activities,
         j.published_at
       FROM   ${schema}.daily_journals j
       WHERE  j.student_id = $1
         AND  j.journal_date >= $2::date
         AND  j.journal_date < $2::date + INTERVAL '7 days'
       ORDER  BY j.journal_date`,
      [studentId, weekStart]
    );
  }

  async classOverview(schema: string, classId: string, date: string): Promise<any[]> {
    return tenantQuery(
      schema,
      `SELECT
         s.id                                          AS student_id,
         CONCAT(s.first_name, ' ', s.last_name)        AS student_name,
         s.admission_no,
         j.id                                          AS journal_id,
         j.mood,
         j.published_at,
         CASE WHEN j.id IS NULL THEN false ELSE true END AS has_journal
       FROM   ${schema}.students s
       LEFT JOIN ${schema}.daily_journals j
              ON j.student_id = s.id AND j.journal_date = $2
       WHERE  s.class_id = $1 AND s.is_active = true
       ORDER  BY s.first_name, s.last_name`,
      [classId, date]
    );
  }
}

export const journalService = new JournalService();
