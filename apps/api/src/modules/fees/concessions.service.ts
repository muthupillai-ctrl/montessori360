import { tenantQuery } from '../../config/database.js';
import { cacheGet, cacheSet, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';

export type DiscountType = 'percentage' | 'fixed';
export type ConcessionCategory = 'sibling' | 'staff_ward' | 'scholarship' | 'need_based' | 'custom';

export interface ConcessionRow {
  id:           string;
  name:         string;
  category:     ConcessionCategory;
  discount_type: DiscountType;
  discount_value: number;
  description:  string | null;
  is_active:    boolean;
  created_at:   string;
  updated_at:   string;
}

export interface StudentConcessionRow {
  id:              string;
  student_id:      string;
  concession_id:   string;
  academic_year:   string | null;
  notes:           string | null;
  approved_by:     string | null;
  created_at:      string;
  // joined
  student_name?:   string;
  admission_no?:   string;
  class_name?:     string;
  concession_name?: string;
  discount_type?:  DiscountType;
  discount_value?: number;
}

export interface SiblingGroup {
  student_id:    string;
  student_name:  string;
  admission_no:  string;
  class_name:    string | null;
  sibling_ids:   string[];
  siblings:      { id: string; name: string; admission_no: string }[];
}

const CACHE_TTL = 300;

class ConcessionsService {

  // ── Ensure tables exist (self-initialising migration) ────────────────────

  private initialisedSchemas = new Set<string>();

  async ensureTables(schema: string): Promise<void> {
    if (this.initialisedSchemas.has(schema)) return;
    await tenantQuery(schema, `
      CREATE TABLE IF NOT EXISTS ${schema}.fee_concessions (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name           TEXT NOT NULL,
        category       TEXT NOT NULL DEFAULT 'custom',
        discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
        discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
        description    TEXT,
        is_active      BOOLEAN NOT NULL DEFAULT true,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS ${schema}.student_concessions (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id     UUID NOT NULL REFERENCES ${schema}.students(id) ON DELETE CASCADE,
        concession_id  UUID NOT NULL REFERENCES ${schema}.fee_concessions(id) ON DELETE CASCADE,
        academic_year  TEXT,
        notes          TEXT,
        approved_by    UUID REFERENCES ${schema}.staff(id),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (student_id, concession_id, academic_year)
      );
    `);
    this.initialisedSchemas.add(schema);
  }

  // ── Concession types ─────────────────────────────────────────────────────

  async list(schema: string): Promise<ConcessionRow[]> {
    await this.ensureTables(schema);
    const key = `${schema}:concessions:list`;
    const cached = await cacheGet<ConcessionRow[]>(key);
    if (cached) return cached;
    const rows = await tenantQuery<ConcessionRow>(
      schema,
      `SELECT * FROM ${schema}.fee_concessions ORDER BY name`
    );
    await cacheSet(key, rows, CACHE_TTL);
    return rows;
  }

  async create(schema: string, dto: {
    name: string; category: ConcessionCategory;
    discount_type: DiscountType; discount_value: number; description?: string;
  }): Promise<ConcessionRow> {
    await this.ensureTables(schema);
    const [row] = await tenantQuery<ConcessionRow>(schema,
      `INSERT INTO ${schema}.fee_concessions (name, category, discount_type, discount_value, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [dto.name, dto.category, dto.discount_type, dto.discount_value, dto.description ?? null]
    );
    await cacheDelPattern(`${schema}:concessions:*`);
    return row;
  }

  async update(schema: string, id: string, dto: {
    name?: string; category?: ConcessionCategory;
    discount_type?: DiscountType; discount_value?: number;
    description?: string; is_active?: boolean;
  }): Promise<ConcessionRow> {
    await this.ensureTables(schema);
    const existing = await this.getById(schema, id);
    const [row] = await tenantQuery<ConcessionRow>(schema,
      `UPDATE ${schema}.fee_concessions SET
         name           = $1,
         category       = $2,
         discount_type  = $3,
         discount_value = $4,
         description    = $5,
         is_active      = $6,
         updated_at     = now()
       WHERE id = $7 RETURNING *`,
      [
        dto.name           ?? existing.name,
        dto.category       ?? existing.category,
        dto.discount_type  ?? existing.discount_type,
        dto.discount_value ?? existing.discount_value,
        dto.description    ?? existing.description,
        dto.is_active      ?? existing.is_active,
        id,
      ]
    );
    await cacheDelPattern(`${schema}:concessions:*`);
    return row;
  }

  async remove(schema: string, id: string): Promise<void> {
    await this.ensureTables(schema);
    // Check if any students are using this concession
    const [usage] = await tenantQuery<{ count: string }>(schema,
      `SELECT COUNT(*)::text AS count FROM ${schema}.student_concessions WHERE concession_id = $1`, [id]
    );
    if (parseInt(usage?.count ?? '0') > 0) {
      throw AppError.badRequest('Cannot delete a concession that is assigned to students. Deactivate it instead.');
    }
    await tenantQuery(schema, `DELETE FROM ${schema}.fee_concessions WHERE id = $1`, [id]);
    await cacheDelPattern(`${schema}:concessions:*`);
  }

  private async getById(schema: string, id: string): Promise<ConcessionRow> {
    const [row] = await tenantQuery<ConcessionRow>(schema,
      `SELECT * FROM ${schema}.fee_concessions WHERE id = $1`, [id]
    );
    if (!row) throw AppError.notFound('Concession');
    return row;
  }

  // ── Student concession assignments ───────────────────────────────────────

  async listAssignments(schema: string, filters: {
    student_id?: string; academic_year?: string; concession_id?: string;
  }): Promise<StudentConcessionRow[]> {
    await this.ensureTables(schema);
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.student_id) {
      params.push(filters.student_id);
      conditions.push(`sc.student_id = $${params.length}`);
    }
    if (filters.concession_id) {
      params.push(filters.concession_id);
      conditions.push(`sc.concession_id = $${params.length}`);
    }
    if (filters.academic_year) {
      params.push(filters.academic_year);
      conditions.push(`(sc.academic_year = $${params.length} OR sc.academic_year IS NULL)`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return tenantQuery<StudentConcessionRow>(schema,
      `SELECT sc.*,
              CONCAT(s.first_name,' ',s.last_name) AS student_name,
              s.admission_no,
              c.name  AS class_name,
              fc.name AS concession_name,
              fc.discount_type,
              fc.discount_value
       FROM   ${schema}.student_concessions sc
       JOIN   ${schema}.students s       ON s.id  = sc.student_id
       LEFT JOIN ${schema}.classes c     ON c.id  = s.class_id
       JOIN   ${schema}.fee_concessions fc ON fc.id = sc.concession_id
       ${where}
       ORDER  BY s.first_name, s.last_name`,
      params
    );
  }

  async assign(schema: string, dto: {
    student_id: string; concession_id: string;
    academic_year?: string; notes?: string; approved_by?: string;
  }): Promise<StudentConcessionRow> {
    await this.ensureTables(schema);
    // Verify student exists
    const [student] = await tenantQuery<{ id: string }>(schema,
      `SELECT id FROM ${schema}.students WHERE id = $1 AND is_active = true`, [dto.student_id]
    );
    if (!student) throw AppError.notFound('Student');
    // Verify concession exists and is active
    const [concession] = await tenantQuery<ConcessionRow>(schema,
      `SELECT * FROM ${schema}.fee_concessions WHERE id = $1 AND is_active = true`, [dto.concession_id]
    );
    if (!concession) throw AppError.notFound('Concession (or it is inactive)');

    const [row] = await tenantQuery<StudentConcessionRow>(schema,
      `INSERT INTO ${schema}.student_concessions
         (student_id, concession_id, academic_year, notes, approved_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (student_id, concession_id, academic_year)
         DO UPDATE SET notes = EXCLUDED.notes, approved_by = EXCLUDED.approved_by
       RETURNING *`,
      [dto.student_id, dto.concession_id, dto.academic_year ?? null, dto.notes ?? null, dto.approved_by ?? null]
    );
    await cacheDelPattern(`${schema}:concessions:assignments:*`);
    return row;
  }

  async removeAssignment(schema: string, id: string): Promise<void> {
    await this.ensureTables(schema);
    const deleted = await tenantQuery<{ id: string }>(schema,
      `DELETE FROM ${schema}.student_concessions WHERE id = $1 RETURNING id`, [id]
    );
    if (!deleted.length) throw AppError.notFound('Assignment');
    await cacheDelPattern(`${schema}:concessions:assignments:*`);
  }

  // ── Sibling groups ───────────────────────────────────────────────────────

  async listSiblingGroups(schema: string): Promise<SiblingGroup[]> {
    await this.ensureTables(schema);
    // Get all active students with at least one sibling
    const students = await tenantQuery<{
      id: string; first_name: string; last_name: string;
      admission_no: string; class_name: string | null; sibling_ids: string[];
    }>(schema,
      `SELECT s.id, s.first_name, s.last_name, s.admission_no,
              c.name AS class_name, s.sibling_ids
       FROM   ${schema}.students s
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       WHERE  s.is_active = true
         AND  s.sibling_ids IS NOT NULL
         AND  array_length(s.sibling_ids, 1) > 0
       ORDER  BY s.first_name, s.last_name`
    );

    // De-duplicate into groups (a group appears once, not once per sibling)
    const seen = new Set<string>();
    const groups: SiblingGroup[] = [];

    for (const s of students) {
      if (seen.has(s.id)) continue;
      // Mark all members of this group as seen
      const memberIds = [s.id, ...s.sibling_ids];
      memberIds.forEach(id => seen.add(id));

      // Fetch sibling details
      const siblings = students.filter(x => s.sibling_ids.includes(x.id));
      groups.push({
        student_id:   s.id,
        student_name: `${s.first_name} ${s.last_name}`,
        admission_no: s.admission_no,
        class_name:   s.class_name,
        sibling_ids:  s.sibling_ids,
        siblings: siblings.map(sib => ({
          id: sib.id,
          name: `${sib.first_name} ${sib.last_name}`,
          admission_no: sib.admission_no,
        })),
      });
    }
    return groups;
  }

  // ── Bulk assign sibling discount to all siblings ─────────────────────────

  async bulkAssignSiblingDiscount(schema: string, dto: {
    concession_id: string; academic_year?: string; notes?: string; approved_by?: string;
  }): Promise<{ assigned: number; skipped: number }> {
    await this.ensureTables(schema);
    const [concession] = await tenantQuery<ConcessionRow>(schema,
      `SELECT * FROM ${schema}.fee_concessions WHERE id = $1 AND is_active = true AND category = 'sibling'`,
      [dto.concession_id]
    );
    if (!concession) throw AppError.badRequest('Select an active sibling-category concession');

    const groups = await this.listSiblingGroups(schema);
    let assigned = 0;
    let skipped  = 0;

    for (const group of groups) {
      const allIds = [group.student_id, ...group.sibling_ids];
      for (const studentId of allIds) {
        try {
          await this.assign(schema, {
            student_id: studentId,
            concession_id: dto.concession_id,
            academic_year: dto.academic_year,
            notes: dto.notes ?? 'Auto-assigned via sibling discount bulk action',
            approved_by: dto.approved_by,
          });
          assigned++;
        } catch {
          skipped++;
        }
      }
    }
    return { assigned, skipped };
  }

  // ── Look up active concession for a student (used by invoice creation) ───

  async getActiveForStudent(schema: string, studentId: string, academicYear?: string): Promise<ConcessionRow | null> {
    await this.ensureTables(schema);
    const rows = await tenantQuery<ConcessionRow & { sc_academic_year: string | null }>(schema,
      `SELECT fc.*, sc.academic_year AS sc_academic_year
       FROM   ${schema}.student_concessions sc
       JOIN   ${schema}.fee_concessions fc ON fc.id = sc.concession_id
       WHERE  sc.student_id = $1
         AND  fc.is_active = true
         AND  (sc.academic_year IS NULL OR sc.academic_year = $2)
       ORDER  BY sc.academic_year DESC NULLS LAST
       LIMIT  1`,
      [studentId, academicYear ?? '']
    );
    return rows[0] ?? null;
  }

  // ── Calculate discounted amount ───────────────────────────────────────────

  calculateDiscount(concession: ConcessionRow, subtotal: number): number {
    if (concession.discount_type === 'percentage') {
      return Math.round((subtotal * concession.discount_value) / 100 * 100) / 100;
    }
    return Math.min(concession.discount_value, subtotal);
  }
}

export const concessionsService = new ConcessionsService();
