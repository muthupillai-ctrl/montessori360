import { PoolClient } from 'pg';
import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  StudentRow, ClassRow,
  CreateStudentDto, UpdateStudentDto,
  StudentFilters, AssignClassDto,
} from './students.types.js';
import type { PaginatedResponse } from '@montessori360/shared';

const CACHE_TTL = 300; // 5 minutes

class StudentsService {

  // ── Admission number generator ────────────────────────────────────────────
  private async nextAdmissionNo(schema: string, client: PoolClient): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const { rows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM ${schema}.students WHERE admission_no LIKE $1`,
      [`ADM${year}%`]
    );
    const seq = String(parseInt(rows[0].cnt) + 1).padStart(4, '0');
    return `ADM${year}${seq}`;
  }

  // ── List students ─────────────────────────────────────────────────────────
  async list(schema: string, filters: StudentFilters): Promise<PaginatedResponse<StudentRow>> {
    const { class_id, is_active = true, search, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const cacheKey = `${schema}:students:list:${JSON.stringify(filters)}`;
    const cached = await cacheGet<PaginatedResponse<StudentRow>>(cacheKey);
    if (cached) return cached;

    const conditions: string[] = ['s.is_active = $1'];
    const params: unknown[] = [is_active];
    let i = 2;

    if (class_id) {
      conditions.push(`s.class_id = $${i++}`);
      params.push(class_id);
    }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.admission_no ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }

    const where = conditions.join(' AND ');

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*) AS total FROM students s WHERE ${where}`,
      params
    );
    const total = parseInt(countRow.total);

    params.push(limit, offset);
    const rows = await tenantQuery<StudentRow>(
      schema,
      `SELECT s.*,
              c.name AS class_name
       FROM   students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE  ${where}
       ORDER  BY s.first_name, s.last_name
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    const result: PaginatedResponse<StudentRow> = {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
    await cacheSet(cacheKey, result, CACHE_TTL);
    return result;
  }

  // ── Get single student ────────────────────────────────────────────────────
  async getById(schema: string, id: string): Promise<StudentRow> {
    const cacheKey = `${schema}:students:${id}`;
    const cached = await cacheGet<StudentRow>(cacheKey);
    if (cached) return cached;

    const [row] = await tenantQuery<StudentRow>(
      schema,
      `SELECT s.*,
              c.name  AS class_name
       FROM   students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE  s.id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('Student');

    await cacheSet(cacheKey, row, CACHE_TTL);
    return row;
  }

  // ── Create student ────────────────────────────────────────────────────────
  async create(schema: string, dto: CreateStudentDto, createdBy: string): Promise<StudentRow> {
    return tenantTransaction(schema, async (client) => {
      // Validate class exists and has capacity if provided
      if (dto.class_id) {
        await this.assertClassCapacity(schema, dto.class_id, client);
      }

      const admissionNo = await this.nextAdmissionNo(schema, client);
      const admissionDate = dto.admission_date ?? new Date().toISOString().slice(0, 10);

      const { rows } = await client.query(
        `INSERT INTO ${schema}.students
           (admission_no, first_name, last_name, dob, gender, class_id,
            blood_group, nationality, aadhar_no, emergency_contacts,
            medical_notes, dietary_notes, allergies, previous_school,
            admission_date, transport_route_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          admissionNo, dto.first_name, dto.last_name, dto.dob,
          dto.gender ?? null, dto.class_id ?? null,
          dto.blood_group ?? null, dto.nationality ?? 'Indian',
          dto.aadhar_no ?? null,
          JSON.stringify(dto.emergency_contacts),
          JSON.stringify(dto.medical_notes ?? {}),
          dto.dietary_notes ?? null,
          dto.allergies ?? [],
          dto.previous_school ?? null,
          admissionDate,
          dto.transport_route_id ?? null,
        ]
      );

      await this.audit(schema, client, createdBy, 'CREATE', 'students', rows[0].id, null, rows[0]);
      await cacheDelPattern(`${schema}:students:list:*`);
      return rows[0] as StudentRow;
    });
  }

  // ── Update student ────────────────────────────────────────────────────────
  async update(schema: string, id: string, dto: UpdateStudentDto, updatedBy: string): Promise<StudentRow> {
    const existing = await this.getById(schema, id);

    return tenantTransaction(schema, async (client) => {
      if (dto.class_id && dto.class_id !== existing.class_id) {
        await this.assertClassCapacity(schema, dto.class_id, client);
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      const settable: (keyof UpdateStudentDto)[] = [
        'first_name', 'last_name', 'dob', 'gender', 'class_id',
        'blood_group', 'nationality', 'aadhar_no', 'emergency_contacts',
        'medical_notes', 'dietary_notes', 'allergies', 'previous_school',
        'admission_date', 'transport_route_id',
      ];

      for (const key of settable) {
        if (dto[key] !== undefined) {
          const col = key;
          const val = ['emergency_contacts', 'medical_notes'].includes(key)
            ? JSON.stringify(dto[key])
            : dto[key];
          fields.push(`${col} = $${i++}`);
          values.push(val);
        }
      }

      if (!fields.length) throw AppError.badRequest('No fields provided for update');

      fields.push(`updated_at = now()`);
      values.push(id);

      const { rows } = await client.query(
        `UPDATE ${schema}.students SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );

      await this.audit(schema, client, updatedBy, 'UPDATE', 'students', id, existing, rows[0]);
      await cacheDel(`${schema}:students:${id}`);
      await cacheDelPattern(`${schema}:students:list:*`);
      return rows[0] as StudentRow;
    });
  }

  // ── Soft delete (deactivate) ──────────────────────────────────────────────
  async deactivate(schema: string, id: string, updatedBy: string): Promise<void> {
    const existing = await this.getById(schema, id);
    if (!existing.is_active) throw AppError.badRequest('Student is already inactive');

    await tenantTransaction(schema, async (client) => {
      await client.query(
        `UPDATE ${schema}.students SET is_active = false, updated_at = now() WHERE id = $1`,
        [id]
      );
      await this.audit(schema, client, updatedBy, 'DEACTIVATE', 'students', id, null, null);
    });

    await cacheDel(`${schema}:students:${id}`);
    await cacheDelPattern(`${schema}:students:list:*`);
  }

  // ── Assign / change class ─────────────────────────────────────────────────
  async assignClass(schema: string, studentId: string, dto: AssignClassDto, updatedBy: string): Promise<StudentRow> {
    return tenantTransaction(schema, async (client) => {
      await this.assertClassCapacity(schema, dto.class_id, client);

      const { rows } = await client.query(
        `UPDATE ${schema}.students
         SET class_id = $1, updated_at = now()
         WHERE id = $2 AND is_active = true
         RETURNING *`,
        [dto.class_id, studentId]
      );
      if (!rows.length) throw AppError.notFound('Student');

      await this.audit(schema, client, updatedBy, 'ASSIGN_CLASS', 'students', studentId, null, { class_id: dto.class_id });
      await cacheDel(`${schema}:students:${studentId}`);
      await cacheDelPattern(`${schema}:students:list:*`);
      return rows[0] as StudentRow;
    });
  }

  // ── Link siblings ─────────────────────────────────────────────────────────
  async linkSiblings(schema: string, studentIdA: string, studentIdB: string, updatedBy: string): Promise<void> {
    if (studentIdA === studentIdB) throw AppError.badRequest('A student cannot be their own sibling');

    const [a, b] = await Promise.all([
      this.getById(schema, studentIdA),
      this.getById(schema, studentIdB),
    ]);

    if ((a.sibling_ids ?? []).includes(studentIdB)) {
      throw AppError.conflict('Students are already linked as siblings');
    }

    await tenantTransaction(schema, async (client) => {
      // Add B to A's sibling list
      await client.query(
        `UPDATE ${schema}.students
         SET sibling_ids = array_append(sibling_ids, $1::uuid), updated_at = now()
         WHERE id = $2`,
        [studentIdB, studentIdA]
      );
      // Add A to B's sibling list
      await client.query(
        `UPDATE ${schema}.students
         SET sibling_ids = array_append(sibling_ids, $1::uuid), updated_at = now()
         WHERE id = $2`,
        [studentIdA, studentIdB]
      );
      await this.audit(schema, client, updatedBy, 'LINK_SIBLINGS', 'students', studentIdA, null, { sibling_id: studentIdB });
    });

    await cacheDel(`${schema}:students:${studentIdA}`);
    await cacheDel(`${schema}:students:${studentIdB}`);
  }

  // ── Unlink siblings ───────────────────────────────────────────────────────
  async unlinkSiblings(schema: string, studentIdA: string, studentIdB: string, updatedBy: string): Promise<void> {
    await tenantTransaction(schema, async (client) => {
      await client.query(
        `UPDATE ${schema}.students
         SET sibling_ids = array_remove(sibling_ids, $1::uuid), updated_at = now()
         WHERE id = $2`,
        [studentIdB, studentIdA]
      );
      await client.query(
        `UPDATE ${schema}.students
         SET sibling_ids = array_remove(sibling_ids, $1::uuid), updated_at = now()
         WHERE id = $2`,
        [studentIdA, studentIdB]
      );
      await this.audit(schema, client, updatedBy, 'UNLINK_SIBLINGS', 'students', studentIdA, null, { sibling_id: studentIdB });
    });

    await cacheDel(`${schema}:students:${studentIdA}`);
    await cacheDel(`${schema}:students:${studentIdB}`);
  }

  // ── Year-end promotion ────────────────────────────────────────────────────
  async promote(schema: string, fromClassId: string, toClassId: string, promotedBy: string): Promise<number> {
    return tenantTransaction(schema, async (client) => {
      // Validate target class exists
      const { rows: [targetClass] } = await client.query(
        `SELECT id, name FROM ${schema}.classes WHERE id = $1 AND is_active = true`,
        [toClassId]
      );
      if (!targetClass) throw AppError.notFound('Target class');

      const { rows } = await client.query(
        `UPDATE ${schema}.students
         SET class_id = $1, updated_at = now()
         WHERE class_id = $2 AND is_active = true
         RETURNING id`,
        [toClassId, fromClassId]
      );

      await this.audit(schema, client, promotedBy, 'BULK_PROMOTE', 'students', fromClassId, null, {
        from_class: fromClassId,
        to_class: toClassId,
        count: rows.length,
      });

      await cacheDelPattern(`${schema}:students:*`);
      return rows.length;
    });
  }

  // ── List classes ──────────────────────────────────────────────────────────
  async listClasses(schema: string): Promise<ClassRow[]> {
    const cacheKey = `${schema}:classes:list`;
    const cached = await cacheGet<ClassRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<ClassRow>(
      schema,
      `SELECT c.*,
              NULLIF(TRIM(CONCAT(st.first_name, ' ', st.last_name)), '') AS teacher_name,
              COUNT(s.id)::int AS enrolled_count
       FROM   classes c
       LEFT JOIN staff st ON st.id = c.teacher_id
       LEFT JOIN students s ON s.class_id = c.id AND s.is_active = true
       WHERE  c.is_active = true
       GROUP  BY c.id, st.first_name, st.last_name
       ORDER  BY c.name`
    );

    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }


  // ── Update class ───────────────────────────────────────────────────────────
  async updateClass(schema: string, classId: string, dto: {
    name?: string; section?: string | null; capacity?: number; age_group_min?: number | null; age_group_max?: number | null; teacher_id?: string | null; room_number?: string | null;
  }): Promise<ClassRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const mapping: Record<string, unknown> = {
      name: dto.name, section: dto.section, capacity: dto.capacity,
      age_group_min: dto.age_group_min, age_group_max: dto.age_group_max,
      teacher_id: dto.teacher_id, room_number: dto.room_number,
    };
    for (const [col, val] of Object.entries(mapping)) {
      if (val !== undefined) { fields.push(`${col} = $${i++}`); values.push(val); }
    }
    if (!fields.length) throw new Error('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(classId);

    const rows = await tenantQuery<ClassRow>(
      schema,
      `UPDATE ${schema}.classes SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) throw new Error('Class not found');
    await cacheDel(`${schema}:classes:list`);
    await cacheDelPattern(`${schema}:students:list:*`);
    return rows[0];
  }

  // ── Delete class (soft) ────────────────────────────────────────────────────
  async deleteClass(schema: string, classId: string): Promise<void> {
    // Check no active students assigned
    const [student] = await tenantQuery(
      schema,
      `SELECT id FROM ${schema}.students WHERE class_id = $1 AND is_active = true LIMIT 1`,
      [classId]
    );
    if (student) throw new Error('Cannot delete a class that has active students. Re-assign students first.');

    const rows = await tenantQuery(
      schema,
      `UPDATE ${schema}.classes SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id`,
      [classId]
    );
    if (!rows.length) throw new Error('Class not found');
    await cacheDel(`${schema}:classes:list`);
    await cacheDelPattern(`${schema}:students:list:*`);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertClassCapacity(schema: string, classId: string, client: PoolClient): Promise<void> {
    const { rows: [cls] } = await client.query(
      `SELECT c.capacity,
              COUNT(s.id)::int AS enrolled
       FROM   ${schema}.classes c
       LEFT JOIN ${schema}.students s ON s.class_id = c.id AND s.is_active = true
       WHERE  c.id = $1 AND c.is_active = true
       GROUP  BY c.capacity`,
      [classId]
    );
    if (!cls) throw AppError.notFound('Class');
    if (cls.enrolled >= cls.capacity) {
      throw AppError.conflict(`Class is at full capacity (${cls.capacity} students)`);
    }
  }

  // ── Student Parents ───────────────────────────────────────────────────────

  async listParents(schema: string, studentId: string): Promise<any[]> {
    return tenantQuery<any>(schema,
      `SELECT * FROM ${schema}.student_parents
       WHERE student_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [studentId]
    );
  }

  async upsertParent(schema: string, studentId: string, dto: any, id?: string): Promise<any> {
    // Enforce max 3 parents per student
    if (!id) {
      const [{ count }] = await tenantQuery<{ count: string }>(schema,
        `SELECT COUNT(*)::text AS count FROM ${schema}.student_parents WHERE student_id = $1`,
        [studentId]
      );
      if (parseInt(count) >= 3) throw AppError.badRequest('Maximum 3 parents allowed per student');
    }

    // If setting as primary, clear existing primary first
    if (dto.is_primary) {
      await tenantQuery(schema,
        `UPDATE ${schema}.student_parents SET is_primary = false WHERE student_id = $1`,
        [studentId]
      );
    }

    if (id) {
      // Update
      const [row] = await tenantQuery<any>(schema,
        `UPDATE ${schema}.student_parents SET
           relation = $1, first_name = $2, last_name = $3, email = $4,
           mobile = $5, mobile_alt = $6, profession = $7, employer = $8,
           annual_income = $9, education = $10, is_primary = $11,
           can_pickup = $12, notes = $13, updated_at = now()
         WHERE id = $14 AND student_id = $15
         RETURNING *`,
        [
          dto.relation, dto.first_name, dto.last_name, dto.email ?? null,
          dto.mobile ?? null, dto.mobile_alt ?? null, dto.profession ?? null,
          dto.employer ?? null, dto.annual_income ?? null, dto.education ?? null,
          dto.is_primary ?? false, dto.can_pickup ?? true, dto.notes ?? null,
          id, studentId,
        ]
      );
      if (!row) throw AppError.notFound('Parent record not found');
      return row;
    } else {
      // Create
      const [row] = await tenantQuery<any>(schema,
        `INSERT INTO ${schema}.student_parents
           (student_id, relation, first_name, last_name, email, mobile, mobile_alt,
            profession, employer, annual_income, education, is_primary, can_pickup, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          studentId, dto.relation, dto.first_name, dto.last_name, dto.email ?? null,
          dto.mobile ?? null, dto.mobile_alt ?? null, dto.profession ?? null,
          dto.employer ?? null, dto.annual_income ?? null, dto.education ?? null,
          dto.is_primary ?? false, dto.can_pickup ?? true, dto.notes ?? null,
        ]
      );
      return row;
    }
  }

  async deleteParent(schema: string, studentId: string, parentId: string): Promise<void> {
    await tenantQuery(schema,
      `DELETE FROM ${schema}.student_parents WHERE id = $1 AND student_id = $2`,
      [parentId, studentId]
    );
  }

  private async audit(
    schema: string,
    client: PoolClient,
    actorId: string,
    action: string,
    entity: string,
    entityId: string | null,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await client.query(
      `INSERT INTO ${schema}.audit_logs (actor_id, actor_type, action, entity, entity_id, delta)
       VALUES ($1, 'staff', $2, $3, $4, $5)`,
      [actorId, action, entity, entityId, JSON.stringify({ before, after })]
    );
  }
}

export const studentsService = new StudentsService();
