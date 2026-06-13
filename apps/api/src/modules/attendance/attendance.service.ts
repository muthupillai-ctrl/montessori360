import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  AttendanceRow, CheckInDto, CheckOutDto, BulkMarkDto,
  AttendanceFilters, MonthlyReportFilters,
  DailySummary, MonthlyStudentReport,
} from './attendance.types.js';
import type { PaginatedResponse } from '@montessori360/shared';

const CACHE_TTL = 120; // 2 minutes for attendance (changes frequently)

class AttendanceService {

  // ── Check in ──────────────────────────────────────────────────────────────
  async checkIn(schema: string, dto: CheckInDto, markedBy: string): Promise<AttendanceRow> {
    const date = (dto as any).date ?? new Date().toISOString().slice(0, 10);

    return tenantTransaction(schema, async (client) => {
      const { rows: [student] } = await client.query(
        `SELECT id FROM ${schema}.students WHERE id = $1 AND is_active = true`,
        [dto.student_id]
      );
      if (!student) throw AppError.notFound('Student');

      // Use explicitly provided status; auto-detect if absent
      let status: string = (dto as any).status ?? null;
      if (!status) {
        const now  = new Date();
        const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
        status = isLate ? 'late' : 'present';
      }

      const checkInTime = (dto as any).check_in_time
        ? new Date((dto as any).check_in_time)
        : (status === 'absent' ? null : new Date());

      const { rows: [existing] } = await client.query(
        `SELECT id FROM ${schema}.attendance WHERE student_id = $1 AND date = $2`,
        [dto.student_id, date]
      );

      let row: AttendanceRow;
      if (existing) {
        const { rows } = await client.query(
          `UPDATE ${schema}.attendance
             SET check_in_time = $1, status = $2, mode = $3, marked_by = $4,
                 notes = $5
           WHERE id = $6 RETURNING *`,
          [checkInTime, status, dto.mode ?? 'manual', markedBy, dto.notes ?? null, existing.id]
        );
        row = rows[0];
      } else {
        const { rows } = await client.query(
          `INSERT INTO ${schema}.attendance
             (student_id, date, check_in_time, status, mode, marked_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [dto.student_id, date, checkInTime, status, dto.mode ?? 'manual', markedBy, dto.notes ?? null]
        );
        row = rows[0];
      }

      await this.invalidateCache(schema, date);
      return row;
    });
  }

    // ── Check out ─────────────────────────────────────────────────────────────
  async checkOut(schema: string, dto: CheckOutDto, markedBy: string): Promise<AttendanceRow> {
    const today = new Date().toISOString().slice(0, 10);

    return tenantTransaction(schema, async (client) => {
      const { rows: [existing] } = await client.query(
        `SELECT id, check_in_time FROM ${schema}.attendance
         WHERE student_id = $1 AND date = $2`,
        [dto.student_id, today]
      );

      if (!existing) throw AppError.badRequest('Student has no check-in record for today');
      if (!existing.check_in_time) throw AppError.badRequest('Student has not checked in yet');

      const { rows } = await client.query(
        `UPDATE ${schema}.attendance
         SET check_out_time = $1, marked_by = $2, notes = COALESCE($3, notes)
         WHERE id = $4 RETURNING *`,
        [new Date(), markedBy, dto.notes ?? null, existing.id]
      );

      await this.invalidateCache(schema, today);
      return rows[0];
    });
  }

  // ── Bulk mark (e.g. mark entire class at once) ────────────────────────────
  async bulkMark(schema: string, dto: BulkMarkDto, markedBy: string): Promise<number> {
    const date = dto.date ?? new Date().toISOString().slice(0, 10);

    return tenantTransaction(schema, async (client) => {
      let count = 0;
      for (const record of dto.records) {
        await client.query(
          `INSERT INTO ${schema}.attendance (student_id, date, status, mode, marked_by, notes)
           VALUES ($1, $2, $3, 'manual', $4, $5)
           ON CONFLICT (student_id, date)
           DO UPDATE SET status = $3, marked_by = $4, notes = COALESCE($5, attendance.notes)`,
          [record.student_id, date, record.status, markedBy, record.notes ?? null]
        );
        count++;
      }
      await this.invalidateCache(schema, date);
      return count;
    });
  }

  // ── Daily summary ─────────────────────────────────────────────────────────
  async dailySummary(schema: string, filters: AttendanceFilters): Promise<DailySummary> {
    const date = filters.date ?? new Date().toISOString().slice(0, 10);
    const cacheKey = `${schema}:attendance:daily:${date}:${filters.class_id ?? 'all'}`;

    const cached = await cacheGet<DailySummary>(cacheKey);
    if (cached) return cached;

    // Total active students in scope
    const classFilter = filters.class_id ? `AND s.class_id = '${filters.class_id}'` : '';

    const [counts] = await tenantQuery<any>(
      schema,
      `SELECT
        COUNT(s.id)::int                                            AS total,
        COUNT(a.id) FILTER (WHERE a.status = 'present')::int       AS present,
        COUNT(a.id) FILTER (WHERE a.status = 'absent')::int        AS absent,
        COUNT(a.id) FILTER (WHERE a.status = 'late')::int          AS late,
        COUNT(a.id) FILTER (WHERE a.status = 'half_day')::int      AS half_day
       FROM ${schema}.students s
       LEFT JOIN ${schema}.attendance a ON a.student_id = s.id AND a.date = $1
       WHERE s.is_active = true ${classFilter}`,
      [date]
    );

    // Fetch detailed records
    const records = await tenantQuery<AttendanceRow>(
      schema,
      `SELECT a.*,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.admission_no,
              c.name AS class_name
       FROM   ${schema}.attendance a
       JOIN   ${schema}.students s ON s.id = a.student_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       WHERE  a.date = $1 ${classFilter}
       ORDER  BY s.first_name, s.last_name`,
      [date]
    );

    const summary: DailySummary = {
      date,
      total:      counts.total,
      present:    counts.present,
      absent:     counts.absent,
      late:       counts.late,
      half_day:   counts.half_day,
      not_marked: counts.total - counts.present - counts.absent - counts.late - counts.half_day,
      records,
    };

    await cacheSet(cacheKey, summary, CACHE_TTL);
    return summary;
  }

  // ── List attendance records ───────────────────────────────────────────────
  async list(schema: string, filters: AttendanceFilters): Promise<PaginatedResponse<AttendanceRow>> {
    const { date, class_id, student_id, status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (date)       { conditions.push(`a.date = $${i++}`);           params.push(date); }
    if (student_id) { conditions.push(`a.student_id = $${i++}`);     params.push(student_id); }
    if (status)     { conditions.push(`a.status = $${i++}`);         params.push(status); }
    if (class_id)   { conditions.push(`s.class_id = $${i++}`);       params.push(class_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total
       FROM ${schema}.attendance a
       JOIN ${schema}.students s ON s.id = a.student_id
       ${where}`,
      params
    );

    params.push(limit, offset);
    const rows = await tenantQuery<AttendanceRow>(
      schema,
      `SELECT a.*,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.admission_no,
              c.name AS class_name
       FROM   ${schema}.attendance a
       JOIN   ${schema}.students s ON s.id = a.student_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       ${where}
       ORDER  BY a.date DESC, s.first_name
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    return {
      data: rows,
      meta: {
        total: parseInt(countRow.total),
        page, limit,
        totalPages: Math.ceil(parseInt(countRow.total) / limit),
      },
    };
  }

  // ── Monthly report ────────────────────────────────────────────────────────
  async monthlyReport(schema: string, filters: MonthlyReportFilters): Promise<MonthlyStudentReport[]> {
    const { year, month, class_id, student_id } = filters;
    const cacheKey = `${schema}:attendance:monthly:${year}-${month}:${class_id ?? 'all'}:${student_id ?? 'all'}`;

    const cached = await cacheGet<MonthlyStudentReport[]>(cacheKey);
    if (cached) return cached;

    const classFilter   = class_id   ? `AND s.class_id = '${class_id}'` : '';
    const studentFilter = student_id ? `AND s.id = '${student_id}'`     : '';

    // Count working days in month (exclude Sundays)
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0) workingDays++; // exclude Sundays
    }

    const rows = await tenantQuery<MonthlyStudentReport>(
      schema,
      `SELECT
         s.id                                                              AS student_id,
         CONCAT(s.first_name, ' ', s.last_name)                           AS student_name,
         s.admission_no,
         COALESCE(c.name, 'Unassigned')                                   AS class_name,
         $1::int                                                           AS total_days,
         COUNT(a.id) FILTER (WHERE a.status = 'present')::int             AS present,
         COUNT(a.id) FILTER (WHERE a.status = 'absent')::int              AS absent,
         COUNT(a.id) FILTER (WHERE a.status = 'late')::int                AS late,
         COUNT(a.id) FILTER (WHERE a.status = 'half_day')::int            AS half_day,
         ROUND(
           COUNT(a.id) FILTER (WHERE a.status IN ('present','late')) * 100.0 / $1,
           1
         )::float                                                          AS percentage
       FROM   ${schema}.students s
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       LEFT JOIN ${schema}.attendance a
              ON a.student_id = s.id
             AND EXTRACT(YEAR  FROM a.date) = $2
             AND EXTRACT(MONTH FROM a.date) = $3
       WHERE  s.is_active = true ${classFilter} ${studentFilter}
       GROUP  BY s.id, s.first_name, s.last_name, s.admission_no, c.name
       ORDER  BY s.first_name, s.last_name`,
      [workingDays, year, month]
    );

    await cacheSet(cacheKey, rows, 600); // 10 min cache for monthly reports
    return rows;
  }

  // ── Get single student attendance for a date ──────────────────────────────
  async getByStudentAndDate(schema: string, studentId: string, date: string): Promise<AttendanceRow | null> {
    const [row] = await tenantQuery<AttendanceRow>(
      schema,
      `SELECT a.*, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.admission_no
       FROM ${schema}.attendance a
       JOIN ${schema}.students s ON s.id = a.student_id
       WHERE a.student_id = $1 AND a.date = $2`,
      [studentId, date]
    );
    return row ?? null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private async invalidateCache(schema: string, date: string): Promise<void> {
    await cacheDel(`${schema}:attendance:daily:${date}:all`);
    // Monthly cache will expire naturally via TTL
  }
}

export const attendanceService = new AttendanceService();
