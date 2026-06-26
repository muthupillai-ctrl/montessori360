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
    const { class_id, is_active = true, no_class, search, rfid_uid, page = 1, limit = 20 } = filters;
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
    if (no_class) {
      conditions.push(`s.class_id IS NULL`);
    }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.admission_no ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (rfid_uid) {
      conditions.push(`s.rfid_card_no = $${i++}`);
      params.push(rfid_uid.toUpperCase());
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
              c.name  AS class_name,
              ep.mobile       AS emergency_mobile,
              ep.first_name   AS emergency_first_name,
              ep.last_name    AS emergency_last_name,
              ep.relation     AS emergency_relation
       FROM   students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN student_parents ep ON ep.student_id = s.id AND ep.is_emergency_contact = true
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
            blood_group, nationality, mother_tongue, aadhar_no,
            medical_notes, dietary_notes, allergies, previous_school,
            admission_date, transport_route_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          admissionNo, dto.first_name, dto.last_name ?? '', dto.dob,
          dto.gender ?? null, dto.class_id ?? null,
          dto.blood_group ?? null, dto.nationality ?? 'Indian',
          dto.mother_tongue ?? null,
          dto.aadhar_no ?? null,
          JSON.stringify(dto.medical_notes ?? {}),
          dto.dietary_notes ?? null,
          dto.allergies ?? [],
          dto.previous_school ?? null,
          admissionDate,
          dto.transport_route_id ?? null,
        ]
      );

      const student = rows[0] as StudentRow;

      // Insert parent records in the same transaction if provided
      if (dto.parents?.length) {
        for (let i = 0; i < dto.parents.length; i++) {
          const p = dto.parents[i];
          await client.query(
            `INSERT INTO ${schema}.student_parents
               (student_id, relation, first_name, last_name, mobile, email, mobile_alt,
                is_primary, is_emergency_contact,
                address_line1, address_line2, city, state, country, pincode,
                profession, employer, annual_income, education, can_pickup, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
            [
              student.id, p.relation, p.first_name, p.last_name ?? '',
              p.mobile ?? null, p.email ?? null, p.mobile_alt ?? null,
              p.is_primary ?? (i === 0),
              p.is_emergency_contact ?? false,
              p.address_line1 ?? null, p.address_line2 ?? null,
              p.city ?? null, p.state ?? null, p.country ?? null, p.pincode ?? null,
              p.profession ?? null, p.employer ?? null, p.annual_income ?? null,
              p.education ?? null, p.can_pickup ?? true, p.notes ?? null,
            ]
          );
        }
      }

      await this.audit(schema, client, createdBy, 'CREATE', 'students', student.id, null, student);
      await cacheDelPattern(`${schema}:students:list:*`);
      return student;
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
        'blood_group', 'nationality', 'mother_tongue', 'aadhar_no',
        'medical_notes', 'dietary_notes', 'allergies', 'previous_school',
        'admission_date', 'transport_route_id',
      ];

      for (const key of settable) {
        if (dto[key] !== undefined) {
          const col = key;
          const val = key === 'medical_notes'
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
    name?: string; section?: string | null; capacity?: number; age_group_min?: number | null; age_group_max?: number | null; teacher_id?: string | null; room_number?: string | null; is_active?: boolean;
  }): Promise<ClassRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const mapping: Record<string, unknown> = {
      name: dto.name, section: dto.section, capacity: dto.capacity,
      age_group_min: dto.age_group_min, age_group_max: dto.age_group_max,
      teacher_id: dto.teacher_id, room_number: dto.room_number,
      is_active: (dto as any).is_active,
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
    if (!id) {
      // Enforce max 3 parents per student
      const [{ count }] = await tenantQuery<{ count: string }>(schema,
        `SELECT COUNT(*)::text AS count FROM ${schema}.student_parents WHERE student_id = $1`,
        [studentId]
      );
      if (parseInt(count) >= 3) throw AppError.badRequest('Maximum 3 parents allowed per student');

      // Prevent duplicate email within the same student
      if (dto.email) {
        const [dup] = await tenantQuery<{ id: string }>(schema,
          `SELECT id FROM ${schema}.student_parents WHERE student_id = $1 AND LOWER(email) = LOWER($2)`,
          [studentId, dto.email]
        );
        if (dup) throw AppError.conflict('A parent with this email is already added to this student');
      }
    } else if (dto.email) {
      // On update: ensure we're not duplicating another parent's email for this student
      const [dup] = await tenantQuery<{ id: string }>(schema,
        `SELECT id FROM ${schema}.student_parents WHERE student_id = $1 AND LOWER(email) = LOWER($2) AND id != $3`,
        [studentId, dto.email, id]
      );
      if (dup) throw AppError.conflict('Another parent with this email is already added to this student');
    }

    // If setting as primary, clear existing primary first
    if (dto.is_primary) {
      await tenantQuery(schema,
        `UPDATE ${schema}.student_parents SET is_primary = false WHERE student_id = $1`,
        [studentId]
      );
    }

    // If setting as emergency contact, clear existing emergency contact first
    if (dto.is_emergency_contact) {
      await tenantQuery(schema,
        `UPDATE ${schema}.student_parents SET is_emergency_contact = false WHERE student_id = $1`,
        [studentId]
      );
    }

    let row: any;

    if (id) {
      // Update — use COALESCE for is_emergency_contact so callers that don't send
      // the field (e.g. ParentFormDialog which has no EC toggle) don't accidentally
      // clear the existing designation.
      const [updated] = await tenantQuery<any>(schema,
        `UPDATE ${schema}.student_parents SET
           relation = $1, first_name = $2, last_name = $3, email = $4,
           mobile = $5, mobile_alt = $6, profession = $7, employer = $8,
           annual_income = $9, education = $10, is_primary = $11,
           is_emergency_contact = COALESCE($12, is_emergency_contact),
           can_pickup = $13, notes = $14,
           updated_at = now()
         WHERE id = $15 AND student_id = $16
         RETURNING *`,
        [
          dto.relation, dto.first_name, dto.last_name ?? '', dto.email ?? null,
          dto.mobile ?? null, dto.mobile_alt ?? null, dto.profession ?? null,
          dto.employer ?? null, dto.annual_income ?? null, dto.education ?? null,
          dto.is_primary ?? false,
          dto.is_emergency_contact !== undefined ? dto.is_emergency_contact : null,
          dto.can_pickup ?? true, dto.notes ?? null,
          id, studentId,
        ]
      );
      if (!updated) throw AppError.notFound('Parent record not found');
      row = updated;
    } else {
      // Create
      const [created] = await tenantQuery<any>(schema,
        `INSERT INTO ${schema}.student_parents
           (student_id, relation, first_name, last_name, email, mobile, mobile_alt,
            profession, employer, annual_income, education,
            is_primary, is_emergency_contact, can_pickup, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          studentId, dto.relation, dto.first_name, dto.last_name ?? '', dto.email ?? null,
          dto.mobile ?? null, dto.mobile_alt ?? null, dto.profession ?? null,
          dto.employer ?? null, dto.annual_income ?? null, dto.education ?? null,
          dto.is_primary ?? false, dto.is_emergency_contact ?? false,
          dto.can_pickup ?? true, dto.notes ?? null,
        ]
      );
      row = created;
    }

    // Invalidate student list cache so emergency_mobile reflects the change
    await cacheDel(`${schema}:students:${studentId}`);
    await cacheDelPattern(`${schema}:students:list:*`);

    return row;
  }

  async deleteParent(schema: string, studentId: string, parentId: string): Promise<void> {
    await tenantQuery(schema,
      `DELETE FROM ${schema}.student_parents WHERE id = $1 AND student_id = $2`,
      [parentId, studentId]
    );
    await cacheDel(`${schema}:students:${studentId}`);
    await cacheDelPattern(`${schema}:students:list:*`);
  }

  async listParentsGroupedByStudent(schema: string, search?: string, classId?: string): Promise<any[]> {
    const term    = search  ? `%${search}%`  : null;
    const clsId   = classId || null;
    return tenantQuery<any>(schema, `
      SELECT
        s.id                                          AS student_id,
        s.first_name                                  AS first_name,
        s.last_name                                   AS last_name,
        s.first_name || ' ' || s.last_name            AS student_name,
        c.name                                        AS class_name,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'parent_record_id',     sp.id,
              'first_name',           sp.first_name,
              'last_name',            sp.last_name,
              'relation',             sp.relation,
              'mobile',               sp.mobile,
              'email',                sp.email,
              'is_primary',           sp.is_primary,
              'is_emergency_contact', sp.is_emergency_contact,
              'portal_status',        CASE
                                        WHEN pa.id IS NULL THEN 'none'
                                        WHEN pa.is_active  THEN 'active'
                                        ELSE 'inactive'
                                      END,
              'portal_account_id',    pa.id
            ) ORDER BY sp.is_primary DESC, sp.created_at ASC
          ) FILTER (WHERE sp.id IS NOT NULL),
          '[]'::jsonb
        )                                             AS parents
      FROM   ${schema}.students s
      LEFT JOIN ${schema}.student_parents sp ON sp.student_id = s.id
      LEFT JOIN ${schema}.classes c ON c.id = s.class_id
      LEFT JOIN ${schema}.parent_accounts pa
             ON sp.email IS NOT NULL AND LOWER(pa.email) = LOWER(sp.email)
      WHERE  s.is_active = true
        AND  ($1::text IS NULL
              OR s.first_name  ILIKE $1
              OR s.last_name   ILIKE $1
              OR sp.first_name ILIKE $1
              OR sp.last_name  ILIKE $1)
        AND  ($2::uuid IS NULL OR s.class_id = $2::uuid)
      GROUP BY s.id, s.first_name, s.last_name, c.name
      ORDER BY s.first_name, s.last_name
    `, [term, clsId]);
  }

  async listAllParents(schema: string, search?: string): Promise<any[]> {
    const term = search ? `%${search}%` : null;
    return tenantQuery<any>(schema, `
      SELECT
        CASE WHEN sp.email IS NOT NULL THEN LOWER(sp.email) ELSE sp.id::text END AS group_key,
        MIN(sp.id::text)    AS parent_record_id,
        MIN(sp.first_name)  AS first_name,
        MIN(sp.last_name)   AS last_name,
        MIN(sp.email)       AS email,
        MIN(sp.mobile)      AS mobile,
        bool_or(sp.is_primary) AS is_primary,
        jsonb_agg(jsonb_build_object(
          'id',       s.id,
          'name',     s.first_name || ' ' || s.last_name,
          'class',    c.name,
          'relation', sp.relation
        )) AS students,
        CASE
          WHEN MAX(pa.id::text) IS NULL THEN 'none'
          WHEN bool_or(pa.is_active) THEN 'active'
          ELSE 'inactive'
        END AS portal_status,
        MAX(pa.id::text) AS portal_account_id
      FROM ${schema}.student_parents sp
      JOIN ${schema}.students s ON s.id = sp.student_id
      LEFT JOIN ${schema}.classes c ON c.id = s.class_id
      LEFT JOIN ${schema}.parent_accounts pa
             ON sp.email IS NOT NULL AND LOWER(pa.email) = LOWER(sp.email)
      WHERE ($1::text IS NULL
             OR sp.first_name ILIKE $1
             OR sp.last_name  ILIKE $1
             OR LOWER(sp.email) ILIKE $1)
      GROUP BY CASE WHEN sp.email IS NOT NULL THEN LOWER(sp.email) ELSE sp.id::text END
      ORDER BY MIN(sp.last_name), MIN(sp.first_name)
    `, [term]);
  }

  async listPortalAccounts(schema: string, search?: string, status?: string): Promise<any[]> {
    const term   = search ? `%${search}%` : null;
    const active = status === 'active' ? true : status === 'inactive' ? false : null;
    return tenantQuery<any>(schema, `
      SELECT
        pa.id,
        pa.email,
        pa.first_name,
        pa.last_name,
        pa.phone,
        pa.is_active,
        pa.created_at,
        (
          SELECT jsonb_agg(jsonb_build_object(
            'id',    s.id,
            'name',  s.first_name || ' ' || s.last_name,
            'class', c.name
          ))
          FROM   unnest(pa.student_ids) AS sid
          JOIN   ${schema}.students s ON s.id = sid
          LEFT JOIN ${schema}.classes c ON c.id = s.class_id
        ) AS students
      FROM ${schema}.parent_accounts pa
      WHERE ($1::text IS NULL
             OR pa.first_name ILIKE $1
             OR pa.last_name  ILIKE $1
             OR pa.email      ILIKE $1)
        AND ($2::boolean IS NULL OR pa.is_active = $2)
      ORDER BY pa.last_name, pa.first_name
    `, [term, active]);
  }

  async getParentRecordById(schema: string, parentRecordId: string): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `SELECT sp.*, s.id AS student_id
       FROM ${schema}.student_parents sp
       JOIN ${schema}.students s ON s.id = sp.student_id
       WHERE sp.id = $1`,
      [parentRecordId]
    );
    if (!row) throw AppError.notFound('Parent record');
    return row;
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
  async exportStudents(schema: string, classId?: string): Promise<any[]> {
    const rows = await tenantQuery<any>(schema, `
      SELECT
        s.admission_no,
        s.first_name,
        s.last_name,
        TO_CHAR(s.dob, 'DD/MM/YYYY')           AS dob,
        s.gender,
        s.blood_group,
        s.nationality,
        s.mother_tongue,
        s.aadhar_no,
        s.allergies,
        s.dietary_notes,
        s.medical_notes,
        s.previous_school,
        TO_CHAR(s.admission_date, 'DD/MM/YYYY') AS admission_date,
        c.name                                   AS class_name,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'relation',             sp.relation,
              'first_name',           sp.first_name,
              'last_name',            sp.last_name,
              'mobile',               sp.mobile,
              'email',                sp.email,
              'mobile_alt',           sp.mobile_alt,
              'is_primary',           sp.is_primary,
              'is_emergency_contact', sp.is_emergency_contact,
              'profession',           sp.profession,
              'employer',             sp.employer,
              'annual_income',        sp.annual_income,
              'education',            sp.education,
              'can_pickup',           sp.can_pickup,
              'address_line1',        sp.address_line1,
              'city',                 sp.city,
              'state',                sp.state,
              'pincode',              sp.pincode,
              'notes',                sp.notes
            ) ORDER BY sp.is_primary DESC, sp.created_at ASC
          ) FILTER (WHERE sp.id IS NOT NULL),
          '[]'::jsonb
        ) AS parents
      FROM ${schema}.students s
      LEFT JOIN ${schema}.classes c ON c.id = s.class_id
      LEFT JOIN ${schema}.student_parents sp ON sp.student_id = s.id
      WHERE s.is_active = true
        AND ($1::uuid IS NULL OR s.class_id = $1::uuid)
      GROUP BY s.id, c.name
      ORDER BY c.name NULLS LAST, s.first_name, s.last_name
    `, [classId || null]);

    return rows.map((r: any) => ({
      ...r,
      parents:       typeof r.parents === 'string' ? JSON.parse(r.parents) : (r.parents ?? []),
      allergies:     Array.isArray(r.allergies) ? r.allergies.join(', ') : '',
      medical_notes: r.medical_notes && typeof r.medical_notes === 'object' ? JSON.stringify(r.medical_notes) : (r.medical_notes ?? ''),
    }));
  }
}

export const studentsService = new StudentsService();
