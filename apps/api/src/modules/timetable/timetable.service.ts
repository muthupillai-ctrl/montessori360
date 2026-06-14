import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { PoolClient } from 'pg';

const DAYS = ['mon','tue','wed','thu','fri','sat'];
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

class TimetableService {

  // ── Subjects ────────────────────────────────────────────────────────────────

  async listSubjects(schema: string): Promise<any[]> {
    return tenantQuery(schema,
      `SELECT * FROM ${schema}.subjects WHERE is_active = true ORDER BY name`, []
    );
  }

  async createSubject(schema: string, dto: any): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.subjects (name, code, color, description)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [dto.name, dto.code ?? null, dto.color ?? '#2563EB', dto.description ?? null]
    );
    return row;
  }

  async updateSubject(schema: string, id: string, dto: any): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (dto.name        !== undefined) { fields.push(`name=$${i++}`);        values.push(dto.name); }
    if (dto.code        !== undefined) { fields.push(`code=$${i++}`);        values.push(dto.code); }
    if (dto.color       !== undefined) { fields.push(`color=$${i++}`);       values.push(dto.color); }
    if (dto.description !== undefined) { fields.push(`description=$${i++}`); values.push(dto.description); }
    if (dto.is_active   !== undefined) { fields.push(`is_active=$${i++}`);   values.push(dto.is_active); }
    fields.push(`updated_at=now()`);
    values.push(id);
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.subjects SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, values
    );
    if (!row) throw AppError.notFound('Subject');
    return row;
  }

  // ── Period Templates ─────────────────────────────────────────────────────────

  async listTemplates(schema: string): Promise<any[]> {
    const templates = await tenantQuery<any>(schema,
      `SELECT pt.*, COUNT(ts.id)::int AS slot_count
       FROM ${schema}.period_templates pt
       LEFT JOIN ${schema}.template_slots ts ON ts.template_id = pt.id
       WHERE pt.is_active = true
       GROUP BY pt.id ORDER BY pt.name`, []
    );
    // Load slots for each template
    for (const t of templates) {
      t.slots = await tenantQuery(schema,
        `SELECT * FROM ${schema}.template_slots WHERE template_id = $1 ORDER BY sort_order, start_time`,
        [t.id]
      );
    }
    return templates;
  }

  async getTemplate(schema: string, id: string): Promise<any> {
    const [template] = await tenantQuery<any>(schema,
      `SELECT * FROM ${schema}.period_templates WHERE id = $1`, [id]
    );
    if (!template) throw AppError.notFound('Template');
    template.slots = await tenantQuery(schema,
      `SELECT * FROM ${schema}.template_slots WHERE template_id = $1 ORDER BY sort_order, start_time`,
      [id]
    );
    return template;
  }

  async createTemplate(schema: string, dto: any): Promise<any> {
    return tenantTransaction(schema, async (client: PoolClient) => {
      const { rows: [template] } = await client.query(
        `INSERT INTO ${schema}.period_templates (name, description, is_default)
         VALUES ($1,$2,$3) RETURNING *`,
        [dto.name, dto.description ?? null, dto.is_default ?? false]
      );
      if (dto.is_default) {
        await client.query(
          `UPDATE ${schema}.period_templates SET is_default=false WHERE id != $1`, [template.id]
        );
      }
      // Insert slots
      if (dto.slots?.length) {
        for (let i = 0; i < dto.slots.length; i++) {
          const s = dto.slots[i];
          await client.query(
            `INSERT INTO ${schema}.template_slots
               (template_id, name, slot_type, start_time, end_time, sort_order, color)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [template.id, s.name, s.slot_type ?? 'period', s.start_time, s.end_time, i, s.color ?? null]
          );
        }
      }
      template.slots = await client.query(
        `SELECT * FROM ${schema}.template_slots WHERE template_id = $1 ORDER BY sort_order`,
        [template.id]
      ).then(r => r.rows);
      return template;
    });
  }

  async updateTemplate(schema: string, id: string, dto: any): Promise<any> {
    return tenantTransaction(schema, async (client: PoolClient) => {
      const fields: string[] = ['updated_at=now()'];
      const values: any[] = [];
      let i = 1;
      if (dto.name        !== undefined) { fields.push(`name=$${i++}`);        values.push(dto.name); }
      if (dto.description !== undefined) { fields.push(`description=$${i++}`); values.push(dto.description); }
      if (dto.is_default  !== undefined) { fields.push(`is_default=$${i++}`);  values.push(dto.is_default); }
      values.push(id);
      const { rows: [template] } = await client.query(
        `UPDATE ${schema}.period_templates SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, values
      );
      if (!template) throw AppError.notFound('Template');

      if (dto.is_default) {
        await client.query(
          `UPDATE ${schema}.period_templates SET is_default=false WHERE id != $1`, [id]
        );
      }

      // Replace slots if provided
      if (dto.slots) {
        await client.query(`DELETE FROM ${schema}.template_slots WHERE template_id=$1`, [id]);
        for (let j = 0; j < dto.slots.length; j++) {
          const s = dto.slots[j];
          await client.query(
            `INSERT INTO ${schema}.template_slots
               (template_id, name, slot_type, start_time, end_time, sort_order, color)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [id, s.name, s.slot_type ?? 'period', s.start_time, s.end_time, j, s.color ?? null]
          );
        }
      }
      template.slots = await client.query(
        `SELECT * FROM ${schema}.template_slots WHERE template_id=$1 ORDER BY sort_order`,
        [id]
      ).then(r => r.rows);
      return template;
    });
  }

  // ── Timetables ───────────────────────────────────────────────────────────────

  async listTimetables(schema: string): Promise<any[]> {
    return tenantQuery(schema,
      `SELECT tt.*, c.name AS class_name, c.section AS class_section,
              c.age_group_min, c.age_group_max,
              mt.name  AS mon_template_name, tut.name AS tue_template_name,
              wt.name  AS wed_template_name, tht.name AS thu_template_name,
              ft.name  AS fri_template_name, st.name  AS sat_template_name
       FROM   ${schema}.timetables tt
       JOIN   ${schema}.classes c ON c.id = tt.class_id
       LEFT JOIN ${schema}.period_templates mt  ON mt.id  = tt.mon_template
       LEFT JOIN ${schema}.period_templates tut ON tut.id = tt.tue_template
       LEFT JOIN ${schema}.period_templates wt  ON wt.id  = tt.wed_template
       LEFT JOIN ${schema}.period_templates tht ON tht.id = tt.thu_template
       LEFT JOIN ${schema}.period_templates ft  ON ft.id  = tt.fri_template
       LEFT JOIN ${schema}.period_templates st  ON st.id  = tt.sat_template
       ORDER  BY c.name`, []
    );
  }

  async getTimetable(schema: string, id: string): Promise<any> {
    const [tt] = await tenantQuery<any>(schema,
      `SELECT tt.*, c.name AS class_name
       FROM ${schema}.timetables tt
       JOIN ${schema}.classes c ON c.id = tt.class_id
       WHERE tt.id = $1`, [id]
    );
    if (!tt) throw AppError.notFound('Timetable');

    // Load all slots with subject + teacher info
    tt.slots = await tenantQuery(schema,
      `SELECT ts.*, sub.name AS subject_name, sub.color AS subject_color, sub.code AS subject_code,
              CONCAT(st.first_name,' ',st.last_name) AS teacher_name,
              tsl.name AS slot_name, tsl.start_time, tsl.end_time, tsl.slot_type AS template_slot_type,
              tsl.sort_order
       FROM   ${schema}.timetable_slots ts
       JOIN   ${schema}.template_slots tsl ON tsl.id = ts.template_slot_id
       LEFT JOIN ${schema}.subjects sub ON sub.id = ts.subject_id
       LEFT JOIN ${schema}.staff st ON st.id = ts.teacher_id
       WHERE  ts.timetable_id = $1
       ORDER  BY ts.day_of_week, tsl.sort_order`, [id]
    );

    return tt;
  }

  async createTimetable(schema: string, dto: any): Promise<any> {
    const existing = await tenantQuery<any>(schema,
      `SELECT id FROM ${schema}.timetables WHERE class_id=$1 AND academic_year=$2`,
      [dto.class_id, dto.academic_year]
    );
    if (existing.length) throw AppError.conflict('Timetable already exists for this class and academic year');

    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.timetables
         (class_id, academic_year, name, mon_template, tue_template, wed_template,
          thu_template, fri_template, sat_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [dto.class_id, dto.academic_year, dto.name ?? null,
       dto.mon_template ?? null, dto.tue_template ?? null, dto.wed_template ?? null,
       dto.thu_template ?? null, dto.fri_template ?? null, dto.sat_template ?? null]
    );
    return this.getTimetable(schema, row.id);
  }

  async updateTimetable(schema: string, id: string, dto: any): Promise<any> {
    const fields: string[] = ['updated_at=now()'];
    const values: any[] = [];
    let i = 1;
    const dayFields = ['mon_template','tue_template','wed_template','thu_template','fri_template','sat_template'];
    for (const f of ['name', ...dayFields]) {
      if (dto[f] !== undefined) { fields.push(`${f}=$${i++}`); values.push(dto[f]); }
    }
    values.push(id);
    await tenantQuery(schema,
      `UPDATE ${schema}.timetables SET ${fields.join(',')} WHERE id=$${i}`, values
    );
    return this.getTimetable(schema, id);
  }

  async upsertSlot(schema: string, timetableId: string, dto: any, approverId?: string): Promise<any> {
    // Check for teacher conflict
    if (dto.teacher_id) {
      const conflict = await tenantQuery<any>(schema,
        `SELECT ts.id, c.name AS class_name, tsl.name AS slot_name
         FROM   ${schema}.timetable_slots ts
         JOIN   ${schema}.timetables tt ON tt.id = ts.timetable_id
         JOIN   ${schema}.classes c ON c.id = tt.class_id
         JOIN   ${schema}.template_slots tsl ON tsl.id = ts.template_slot_id
         WHERE  ts.teacher_id = $1
           AND  ts.day_of_week = $2
           AND  ts.timetable_id != $3
           AND  ts.conflict_approved = false
           AND  EXISTS (
             SELECT 1 FROM ${schema}.template_slots tsl2
             WHERE tsl2.id = $4
               AND tsl2.start_time < tsl.end_time
               AND tsl2.end_time   > tsl.start_time
           )`,
        [dto.teacher_id, dto.day_of_week, timetableId, dto.template_slot_id]
      );
      if (conflict.length && !approverId) {
        throw AppError.conflict(
          `Teacher is already assigned to ${conflict[0].class_name} during this slot (${conflict[0].slot_name}). Admin approval required to override.`
        );
      }
    }

    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.timetable_slots
         (timetable_id, template_slot_id, day_of_week, subject_id, teacher_id,
          slot_type, notes, conflict_approved, conflict_approved_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (timetable_id, template_slot_id, day_of_week)
       DO UPDATE SET
         subject_id=$4, teacher_id=$5, slot_type=$6, notes=$7,
         conflict_approved=$8, conflict_approved_by=$9, updated_at=now()
       RETURNING *`,
      [timetableId, dto.template_slot_id, dto.day_of_week,
       dto.subject_id ?? null, dto.teacher_id ?? null,
       dto.slot_type ?? 'period', dto.notes ?? null,
       !!approverId, approverId ?? null]
    );
    return row;
  }

  async clearSlot(schema: string, timetableId: string, templateSlotId: string, dayOfWeek: number): Promise<void> {
    await tenantQuery(schema,
      `DELETE FROM ${schema}.timetable_slots
       WHERE timetable_id=$1 AND template_slot_id=$2 AND day_of_week=$3`,
      [timetableId, templateSlotId, dayOfWeek]
    );
  }

  async getTeacherSchedule(schema: string, teacherId: string, academicYear: string): Promise<any> {
    const slots = await tenantQuery<any>(schema,
      `SELECT ts.day_of_week, tsl.name AS slot_name, tsl.start_time, tsl.end_time,
              sub.name AS subject_name, sub.color AS subject_color,
              c.name AS class_name, ts.slot_type, ts.notes
       FROM   ${schema}.timetable_slots ts
       JOIN   ${schema}.timetables tt ON tt.id = ts.timetable_id
       JOIN   ${schema}.classes c ON c.id = tt.class_id
       JOIN   ${schema}.template_slots tsl ON tsl.id = ts.template_slot_id
       LEFT JOIN ${schema}.subjects sub ON sub.id = ts.subject_id
       WHERE  ts.teacher_id = $1 AND tt.academic_year = $2
       ORDER  BY ts.day_of_week, tsl.sort_order`,
      [teacherId, academicYear]
    );

    // Group by day
    const byDay: Record<number, any[]> = {};
    for (const s of slots) {
      if (!byDay[s.day_of_week]) byDay[s.day_of_week] = [];
      byDay[s.day_of_week].push(s);
    }
    return { slots, byDay };
  }

  // ── Class Subject Teachers ──────────────────────────────────────────────────

  async getClassSubjectTeachers(schema: string, classId: string): Promise<any[]> {
    return tenantQuery(schema,
      `SELECT sub.id AS subject_id, sub.name AS subject_name,
              sub.color AS subject_color, sub.code AS subject_code,
              cst.id, cst.teacher_id,
              CONCAT(st.first_name,' ',st.last_name) AS teacher_name
       FROM   ${schema}.subjects sub
       LEFT JOIN ${schema}.class_subject_teachers cst
              ON cst.subject_id = sub.id AND cst.class_id = $1
       LEFT JOIN ${schema}.staff st ON st.id = cst.teacher_id
       WHERE  sub.is_active = true
       ORDER  BY sub.name`, [classId]
    );
  }

  async upsertClassSubjectTeacher(schema: string, classId: string, subjectId: string, teacherId: string | null): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.class_subject_teachers (class_id, subject_id, teacher_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, subject_id)
       DO UPDATE SET teacher_id = $3, updated_at = now()
       RETURNING *`,
      [classId, subjectId, teacherId]
    );
    return row;
  }

  async getSubjectTeacherForSlot(schema: string, classId: string, subjectId: string): Promise<string | null> {
    const [row] = await tenantQuery<any>(schema,
      `SELECT teacher_id FROM ${schema}.class_subject_teachers
       WHERE class_id = $1 AND subject_id = $2`,
      [classId, subjectId]
    );
    return row?.teacher_id ?? null;
  }
}

export const timetableService = new TimetableService();
