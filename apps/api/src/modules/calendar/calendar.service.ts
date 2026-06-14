import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  AcademicYearRow, TermRow, CalendarEventRow, TimetableSlotRow,
  CreateAcademicYearDto, CreateTermDto, CreateEventDto, CreateTimetableSlotDto,
  CalendarFilters, WorkingDayResult, DayOfWeek,
} from './calendar.types.js';

const CACHE_TTL = 300;

class CalendarService {

  // ── Academic Years ────────────────────────────────────────────────────────

  async listAcademicYears(schema: string): Promise<AcademicYearRow[]> {
    const cacheKey = `${schema}:calendar:years`;
    const cached = await cacheGet<AcademicYearRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<AcademicYearRow>(
      schema,
      `SELECT * FROM ${schema}.academic_years ORDER BY start_date DESC`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async getCurrentYear(schema: string): Promise<AcademicYearRow | null> {
    const [row] = await tenantQuery<AcademicYearRow>(
      schema,
      `SELECT * FROM ${schema}.academic_years WHERE is_current = true LIMIT 1`
    );
    return row ?? null;
  }

  async createAcademicYear(schema: string, dto: CreateAcademicYearDto, createdBy: string): Promise<AcademicYearRow> {
    return tenantTransaction(schema, async (client) => {
      if (dto.is_current) {
        await client.query(
          `UPDATE ${schema}.academic_years SET is_current = false WHERE is_current = true`
        );
      }
      const { rows } = await client.query(
        `INSERT INTO ${schema}.academic_years
           (name, start_date, end_date, working_days, is_current)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [dto.name, dto.start_date, dto.end_date,
         dto.working_days ?? [1,2,3,4,5], dto.is_current ?? false]
      );
      await cacheDel(`${schema}:calendar:years`);
      return rows[0] as AcademicYearRow;
    });
  }

  async updateAcademicYear(schema: string, id: string, dto: Partial<CreateAcademicYearDto>): Promise<AcademicYearRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const mapping: Record<string, unknown> = {
      name: dto.name, start_date: dto.start_date, end_date: dto.end_date,
      working_days: dto.working_days,
    };
    for (const [col, val] of Object.entries(mapping)) {
      if (val !== undefined) { fields.push(`${col} = $${i++}`); values.push(val); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);

    const [row] = await tenantQuery<AcademicYearRow>(
      schema,
      `UPDATE ${schema}.academic_years SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!row) throw AppError.notFound('Academic year');
    await cacheDel(`${schema}:calendar:years`);
    return row;
  }

  async setCurrentYear(schema: string, id: string): Promise<AcademicYearRow> {
    return tenantTransaction(schema, async (client) => {
      await client.query(`UPDATE ${schema}.academic_years SET is_current = false`);
      const { rows } = await client.query(
        `UPDATE ${schema}.academic_years SET is_current = true, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id]
      );
      if (!rows.length) throw AppError.notFound('Academic year');
      await cacheDel(`${schema}:calendar:years`);
      return rows[0] as AcademicYearRow;
    });
  }

  // ── Terms ─────────────────────────────────────────────────────────────────

  async listTerms(schema: string, academicYearId?: string): Promise<TermRow[]> {
    const cacheKey = `${schema}:calendar:terms:${academicYearId ?? 'all'}`;
    const cached = await cacheGet<TermRow[]>(cacheKey);
    if (cached) return cached;

    const where = academicYearId ? `AND t.academic_year_id = '${academicYearId}'` : '';
    const rows = await tenantQuery<TermRow>(
      schema,
      `SELECT t.id, t.academic_year_id, t.name, t.sort_order, t.created_at,
              t.start_date::text AS start_date,
              t.end_date::text   AS end_date,
              ay.name AS academic_year_name
       FROM   ${schema}.terms t
       JOIN   ${schema}.academic_years ay ON ay.id = t.academic_year_id
       WHERE  1=1 ${where}
       ORDER  BY t.start_date`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async updateTerm(schema: string, id: string, dto: Partial<CreateTermDto>): Promise<TermRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const mapping: Record<string, unknown> = {
      name: dto.name, start_date: dto.start_date, end_date: dto.end_date, sort_order: dto.sort_order,
    };
    for (const [col, val] of Object.entries(mapping)) {
      if (val !== undefined) { fields.push(`${col} = $${i++}`); values.push(val); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    values.push(id);
    const [row] = await tenantQuery<TermRow>(
      schema,
      `UPDATE ${schema}.terms SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!row) throw AppError.notFound('Term');
    await cacheDelPattern(`${schema}:calendar:terms:*`);
    return row;
  }

  async deleteTerm(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(schema, `DELETE FROM ${schema}.terms WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Term');
    await cacheDelPattern(`${schema}:calendar:terms:*`);
  }

  async createTerm(schema: string, dto: CreateTermDto): Promise<TermRow> {
    // Verify academic year exists
    const [year] = await tenantQuery<AcademicYearRow>(
      schema, `SELECT id, start_date, end_date FROM ${schema}.academic_years WHERE id = $1`, [dto.academic_year_id]
    );
    if (!year) throw AppError.notFound('Academic year');

    // Validate term dates within year bounds
    if (dto.start_date < year.start_date.toISOString().slice(0, 10) ||
        dto.end_date   > year.end_date.toISOString().slice(0, 10)) {
      throw AppError.badRequest('Term dates must be within academic year bounds');
    }

    const [row] = await tenantQuery<TermRow>(
      schema,
      `INSERT INTO ${schema}.terms (academic_year_id, name, start_date, end_date, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [dto.academic_year_id, dto.name, dto.start_date, dto.end_date, dto.sort_order ?? 1]
    );
    await cacheDelPattern(`${schema}:calendar:terms:*`);
    return row;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async listEvents(schema: string, filters: CalendarFilters): Promise<CalendarEventRow[]> {
    const { from, to, event_type, class_id } = filters;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (from)       { conditions.push(`e.end_date >= $${i++}`);   params.push(from); }
    if (to)         { conditions.push(`e.start_date <= $${i++}`); params.push(to); }
    if (event_type) { conditions.push(`e.event_type = $${i++}`);  params.push(event_type); }
    if (class_id)   {
      conditions.push(`(e.class_ids = '{}' OR $${i++}::uuid = ANY(e.class_ids))`);
      params.push(class_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return tenantQuery<CalendarEventRow>(
      schema,
      `SELECT e.*,
              NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), '') AS author_name
       FROM   ${schema}.calendar_events e
       LEFT JOIN ${schema}.staff s ON s.id = e.created_by
       ${where}
       ORDER  BY e.start_date, e.start_time NULLS LAST`,
      params
    );
  }

  async getEvent(schema: string, id: string): Promise<CalendarEventRow> {
    const [row] = await tenantQuery<CalendarEventRow>(
      schema,
      `SELECT e.*, NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), '') AS author_name
       FROM ${schema}.calendar_events e
       LEFT JOIN ${schema}.staff s ON s.id = e.created_by
       WHERE e.id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('Event');
    return row;
  }

  async createEvent(schema: string, dto: CreateEventDto, createdBy: string): Promise<CalendarEventRow> {
    const [row] = await tenantQuery<CalendarEventRow>(
      schema,
      `INSERT INTO ${schema}.calendar_events
         (title, description, event_type, start_date, end_date, is_all_day,
          start_time, end_time, affects_attendance, class_ids, recurrence, colour, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        dto.title, dto.description ?? null, dto.event_type,
        dto.start_date, dto.end_date, dto.is_all_day ?? true,
        dto.start_time ?? null, dto.end_time ?? null,
        dto.affects_attendance ?? false,
        dto.class_ids ?? [],
        dto.recurrence ?? 'none',
        dto.colour ?? '#2E5AA8',
        createdBy,
      ]
    );

    // If event affects attendance, bulk-mark absent for affected students
    if (dto.affects_attendance) {
      await this.markAttendanceForHoliday(schema, dto.start_date, dto.end_date, dto.class_ids ?? []);
    }

    await cacheDelPattern(`${schema}:calendar:events:*`);
    return row;
  }

  async updateEvent(schema: string, id: string, dto: Partial<CreateEventDto>, updatedBy: string): Promise<CalendarEventRow> {
    await this.getEvent(schema, id);

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const mapping: Record<string, unknown> = {
      title: dto.title, description: dto.description, event_type: dto.event_type,
      start_date: dto.start_date, end_date: dto.end_date, is_all_day: dto.is_all_day,
      start_time: dto.start_time, end_time: dto.end_time,
      affects_attendance: dto.affects_attendance,
      class_ids: dto.class_ids, recurrence: dto.recurrence, colour: dto.colour,
    };

    for (const [col, val] of Object.entries(mapping)) {
      if (val !== undefined) { fields.push(`${col} = $${i++}`); values.push(val); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);

    const [row] = await tenantQuery<CalendarEventRow>(
      schema,
      `UPDATE ${schema}.calendar_events SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    await cacheDelPattern(`${schema}:calendar:events:*`);
    return row;
  }

  async deleteEvent(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(schema, `DELETE FROM ${schema}.calendar_events WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Event');
    await cacheDelPattern(`${schema}:calendar:events:*`);
  }

  // ── Working day checker ───────────────────────────────────────────────────

  async getWorkingDays(schema: string, from: string, to: string): Promise<WorkingDayResult[]> {
    const year = await this.getCurrentYear(schema);
    const workingDays: DayOfWeek[] = (year?.working_days as DayOfWeek[]) ?? [1,2,3,4,5];

    // Get all events in range that affect attendance (holidays/closures)
    const holidays = await this.listEvents(schema, { from, to, event_type: 'holiday' });
    const closures = await this.listEvents(schema, { from, to, event_type: 'closure' });
    const allEvents = await this.listEvents(schema, { from, to });

    const holidayDates = new Set<string>();
    [...holidays, ...closures].forEach(e => {
      const d = new Date(e.start_date);
      const end = new Date(e.end_date);
      while (d <= end) {
        holidayDates.add(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    });

    const results: WorkingDayResult[] = [];
    const current = new Date(from);
    const endDate = new Date(to);

    while (current <= endDate) {
      const dateStr = current.toISOString().slice(0, 10);
      const dow = current.getDay() as DayOfWeek;
      const isWorkingDow = workingDays.includes(dow);
      const isHoliday = holidayDates.has(dateStr);
      const dayEvents = allEvents.filter(e =>
        dateStr >= e.start_date.toString().slice(0, 10) &&
        dateStr <= e.end_date.toString().slice(0, 10)
      );

      results.push({
        date:       dateStr,
        is_working: isWorkingDow && !isHoliday,
        is_holiday: isHoliday,
        events:     dayEvents,
      });
      current.setDate(current.getDate() + 1);
    }

    return results;
  }

  // ── Timetable ─────────────────────────────────────────────────────────────

  async getTimetable(schema: string, classId: string): Promise<TimetableSlotRow[]> {
    const cacheKey = `${schema}:timetable:${classId}`;
    const cached = await cacheGet<TimetableSlotRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<TimetableSlotRow>(
      schema,
      `SELECT t.*,
              NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), '') AS teacher_name,
              c.name AS class_name
       FROM   ${schema}.timetable_slots t
       LEFT JOIN ${schema}.staff s ON s.id = t.teacher_id
       JOIN   ${schema}.classes c  ON c.id = t.class_id
       WHERE  t.class_id = $1
       ORDER  BY t.day_of_week, t.start_time`,
      [classId]
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async createTimetableSlot(schema: string, dto: CreateTimetableSlotDto): Promise<TimetableSlotRow> {
    // Check for time conflicts
    const [conflict] = await tenantQuery(
      schema,
      `SELECT id FROM ${schema}.timetable_slots
       WHERE class_id = $1 AND day_of_week = $2
         AND NOT ($3 >= end_time OR $4 <= start_time)`,
      [dto.class_id, dto.day_of_week, dto.start_time, dto.end_time]
    );
    if (conflict) throw AppError.conflict('Timetable slot conflicts with an existing slot');

    const [row] = await tenantQuery<TimetableSlotRow>(
      schema,
      `INSERT INTO ${schema}.timetable_slots
         (class_id, day_of_week, start_time, end_time, subject, teacher_id, room)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [dto.class_id, dto.day_of_week, dto.start_time, dto.end_time,
       dto.subject, dto.teacher_id ?? null, dto.room ?? null]
    );
    await cacheDel(`${schema}:timetable:${dto.class_id}`);
    return row;
  }

  async deleteTimetableSlot(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(
      schema, `DELETE FROM ${schema}.timetable_slots WHERE id = $1 RETURNING class_id`, [id]
    );
    if (!rows.length) throw AppError.notFound('Timetable slot');
    await cacheDel(`${schema}:timetable:${(rows[0] as any).class_id}`);
  }

  async bulkReplaceTimetable(schema: string, classId: string, slots: CreateTimetableSlotDto[]): Promise<TimetableSlotRow[]> {
    return tenantTransaction(schema, async (client) => {
      // Delete existing
      await client.query(`DELETE FROM ${schema}.timetable_slots WHERE class_id = $1`, [classId]);
      const created: TimetableSlotRow[] = [];
      for (const slot of slots) {
        const { rows } = await client.query(
          `INSERT INTO ${schema}.timetable_slots
             (class_id, day_of_week, start_time, end_time, subject, teacher_id, room)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [classId, slot.day_of_week, slot.start_time, slot.end_time,
           slot.subject, slot.teacher_id ?? null, slot.room ?? null]
        );
        created.push(rows[0]);
      }
      await cacheDel(`${schema}:timetable:${classId}`);
      return created;
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async markAttendanceForHoliday(
    schema: string, startDate: string, endDate: string, classIds: string[]
  ): Promise<void> {
    const classFilter = classIds.length
      ? `AND s.class_id = ANY(ARRAY[${classIds.map(id => `'${id}'`).join(',')}]::uuid[])`
      : '';

    await tenantQuery(
      schema,
      `INSERT INTO ${schema}.attendance (student_id, date, status, mode, notes)
       SELECT s.id, d.date, 'holiday', 'manual', 'School holiday'
       FROM   ${schema}.students s
       CROSS JOIN generate_series($1::date, $2::date, '1 day'::interval) AS d(date)
       WHERE  s.is_active = true ${classFilter}
       ON CONFLICT (student_id, date) DO NOTHING`,
      [startDate, endDate]
    );
  }
}

export const calendarService = new CalendarService();
