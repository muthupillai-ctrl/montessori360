import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  DomainRow, MilestoneRow, ObservationRow,
  StudentProgressSummary, MilestoneProgress,
  CreateDomainDto, CreateMilestoneDto,
  RecordObservationDto, BulkObservationDto, ObservationFilters,
} from './observations.types.js';
import type { PaginatedResponse } from '@montessori360/shared';

const CACHE_TTL = 600; // 10 min — domains/milestones rarely change

class ObservationsService {

  // ── Domains ───────────────────────────────────────────────────────────────

  async listDomains(schema: string): Promise<DomainRow[]> {
    const cacheKey = `${schema}:obs:domains`;
    const cached = await cacheGet<DomainRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<DomainRow>(
      schema,
      `SELECT * FROM ${schema}.obs_domains WHERE is_active = true ORDER BY sort_order, name`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async createDomain(schema: string, dto: CreateDomainDto, createdBy: string): Promise<DomainRow> {
    return tenantTransaction(schema, async (client) => {
      // Check code uniqueness
      const { rows: [existing] } = await client.query(
        `SELECT id FROM ${schema}.obs_domains WHERE code = $1`, [dto.code]
      );
      if (existing) throw AppError.conflict(`Domain code '${dto.code}' already exists`);

      const { rows } = await client.query(
        `INSERT INTO ${schema}.obs_domains (name, code, is_standard, description, sort_order)
         VALUES ($1, $2, false, $3, $4) RETURNING *`,
        [dto.name, dto.code, dto.description ?? null, dto.sort_order ?? 99]
      );
      await cacheDel(`${schema}:obs:domains`);
      return rows[0] as DomainRow;
    });
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  async listMilestones(schema: string, domainId?: string): Promise<MilestoneRow[]> {
    const cacheKey = `${schema}:obs:milestones:${domainId ?? 'all'}`;
    const cached = await cacheGet<MilestoneRow[]>(cacheKey);
    if (cached) return cached;

    const where = domainId ? `AND m.domain_id = '${domainId}'` : '';
    const rows = await tenantQuery<MilestoneRow>(
      schema,
      `SELECT m.*, d.name AS domain_name, d.code AS domain_code
       FROM   ${schema}.obs_milestones m
       JOIN   ${schema}.obs_domains d ON d.id = m.domain_id
       WHERE  m.is_active = true ${where}
       ORDER  BY d.sort_order, m.sort_order, m.code`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async createMilestone(schema: string, dto: CreateMilestoneDto): Promise<MilestoneRow> {
    return tenantTransaction(schema, async (client) => {
      // Verify domain exists
      const { rows: [domain] } = await client.query(
        `SELECT id FROM ${schema}.obs_domains WHERE id = $1 AND is_active = true`, [dto.domain_id]
      );
      if (!domain) throw AppError.notFound('Domain');

      // Check code uniqueness within domain
      const { rows: [existing] } = await client.query(
        `SELECT id FROM ${schema}.obs_milestones WHERE domain_id = $1 AND code = $2`,
        [dto.domain_id, dto.code]
      );
      if (existing) throw AppError.conflict(`Milestone code '${dto.code}' already exists in this domain`);

      const { rows } = await client.query(
        `INSERT INTO ${schema}.obs_milestones
           (domain_id, code, name, description, age_min, age_max, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [dto.domain_id, dto.code, dto.name, dto.description ?? null,
         dto.age_min ?? null, dto.age_max ?? null, dto.sort_order ?? 0]
      );
      await cacheDelPattern(`${schema}:obs:milestones:*`);
      return rows[0] as MilestoneRow;
    });
  }

  // ── Record observation ────────────────────────────────────────────────────

  async record(schema: string, dto: RecordObservationDto, observedBy: string): Promise<ObservationRow> {
    const observedOn = dto.observed_on ?? new Date().toISOString().slice(0, 10);

    return tenantTransaction(schema, async (client) => {
      // Verify student
      const { rows: [student] } = await client.query(
        `SELECT id FROM ${schema}.students WHERE id = $1 AND is_active = true`, [dto.student_id]
      );
      if (!student) throw AppError.notFound('Student');

      // Verify milestone and get domain_id
      const { rows: [milestone] } = await client.query(
        `SELECT id, domain_id FROM ${schema}.obs_milestones WHERE id = $1 AND is_active = true`,
        [dto.milestone_id]
      );
      if (!milestone) throw AppError.notFound('Milestone');

      // Upsert — one observation per student per milestone (update grade if re-observed)
      const { rows } = await client.query(
        `INSERT INTO ${schema}.observations
           (student_id, milestone_id, domain_id, grade, notes, observed_by, observed_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (student_id, milestone_id)
         DO UPDATE SET
           grade       = EXCLUDED.grade,
           notes       = EXCLUDED.notes,
           observed_by = EXCLUDED.observed_by,
           observed_on = EXCLUDED.observed_on,
           updated_at  = now()
         RETURNING *`,
        [dto.student_id, dto.milestone_id, milestone.domain_id,
         dto.grade, dto.notes ?? null, observedBy, observedOn]
      );

      await cacheDelPattern(`${schema}:obs:progress:${dto.student_id}:*`);
      return rows[0] as ObservationRow;
    });
  }

  // ── Bulk record ───────────────────────────────────────────────────────────

  async bulkRecord(schema: string, dto: BulkObservationDto, observedBy: string): Promise<number> {
    const observedOn = dto.observed_on ?? new Date().toISOString().slice(0, 10);

    // Verify student
    const [student] = await tenantQuery(
      schema,
      `SELECT id FROM ${schema}.students WHERE id = $1 AND is_active = true`,
      [dto.student_id]
    );
    if (!student) throw AppError.notFound('Student');

    return tenantTransaction(schema, async (client) => {
      let count = 0;
      for (const obs of dto.observations) {
        const { rows: [milestone] } = await client.query(
          `SELECT id, domain_id FROM ${schema}.obs_milestones WHERE id = $1 AND is_active = true`,
          [obs.milestone_id]
        );
        if (!milestone) continue; // skip invalid milestones silently

        await client.query(
          `INSERT INTO ${schema}.observations
             (student_id, milestone_id, domain_id, grade, notes, observed_by, observed_on)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (student_id, milestone_id)
           DO UPDATE SET
             grade       = EXCLUDED.grade,
             notes       = EXCLUDED.notes,
             observed_by = EXCLUDED.observed_by,
             observed_on = EXCLUDED.observed_on,
             updated_at  = now()`,
          [dto.student_id, obs.milestone_id, milestone.domain_id,
           obs.grade, obs.notes ?? null, observedBy, observedOn]
        );
        count++;
      }
      await cacheDelPattern(`${schema}:obs:progress:${dto.student_id}:*`);
      return count;
    });
  }

  // ── Student progress summary ──────────────────────────────────────────────

  async getStudentProgress(schema: string, studentId: string): Promise<StudentProgressSummary[]> {
    const cacheKey = `${schema}:obs:progress:${studentId}:summary`;
    const cached = await cacheGet<StudentProgressSummary[]>(cacheKey);
    if (cached) return cached;

    // Verify student
    const [student] = await tenantQuery(
      schema, `SELECT id FROM ${schema}.students WHERE id = $1`, [studentId]
    );
    if (!student) throw AppError.notFound('Student');

    // Get all domains
    const domains = await this.listDomains(schema);

    const summaries: StudentProgressSummary[] = [];

    for (const domain of domains) {
      // Get all milestones for this domain
      const milestones = await tenantQuery<MilestoneRow>(
        schema,
        `SELECT * FROM ${schema}.obs_milestones WHERE domain_id = $1 AND is_active = true ORDER BY sort_order, code`,
        [domain.id]
      );

      if (!milestones.length) continue;

      // Get observations for this student + domain
      const observations = await tenantQuery<ObservationRow>(
        schema,
        `SELECT milestone_id, grade, notes, observed_on
         FROM ${schema}.observations
         WHERE student_id = $1 AND domain_id = $2`,
        [studentId, domain.id]
      );

      const obsMap = new Map(observations.map(o => [o.milestone_id, o]));

      const milestoneProgress: MilestoneProgress[] = milestones.map(m => {
        const obs = obsMap.get(m.id);
        return {
          milestone_id:   m.id,
          milestone_code: m.code,
          milestone_name: m.name,
          grade:          obs?.grade ?? null,
          notes:          obs?.notes ?? null,
          observed_on:    obs?.observed_on ?? null,
        };
      });

      const graded     = milestoneProgress.filter(m => m.grade !== null);
      const notStarted = milestoneProgress.filter(m => m.grade === 'not_started').length;
      const inProgress = milestoneProgress.filter(m => m.grade === 'in_progress').length;
      const led        = milestoneProgress.filter(m => m.grade === 'led').length;
      const mastered   = milestoneProgress.filter(m => m.grade === 'mastered').length;
      const total      = milestones.length;

      summaries.push({
        domain_id:   domain.id,
        domain_name: domain.name,
        domain_code: domain.code,
        total,
        not_started: notStarted,
        in_progress: inProgress,
        led,
        mastered,
        percentage:  total > 0 ? Math.round((mastered / total) * 100 * 10) / 10 : 0,
        milestones:  milestoneProgress,
      });
    }

    await cacheSet(cacheKey, summaries, CACHE_TTL);
    return summaries;
  }

  // ── List observations ─────────────────────────────────────────────────────

  async list(schema: string, filters: ObservationFilters): Promise<PaginatedResponse<ObservationRow>> {
    const { student_id, domain_id, grade, date_from, date_to, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (student_id) { conditions.push(`o.student_id = $${i++}`);   params.push(student_id); }
    if (domain_id)  { conditions.push(`o.domain_id = $${i++}`);    params.push(domain_id); }
    if (grade)      { conditions.push(`o.grade = $${i++}`);        params.push(grade); }
    if (date_from)  { conditions.push(`o.observed_on >= $${i++}`); params.push(date_from); }
    if (date_to)    { conditions.push(`o.observed_on <= $${i++}`); params.push(date_to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total FROM ${schema}.observations o ${where}`,
      params
    );

    params.push(limit, offset);
    const rows = await tenantQuery<ObservationRow>(
      schema,
      `SELECT o.*,
              CONCAT(s.first_name, ' ', s.last_name)                          AS student_name,
              s.admission_no,
              m.name                                                           AS milestone_name,
              m.code                                                           AS milestone_code,
              d.name                                                           AS domain_name,
              d.code                                                           AS domain_code,
              NULLIF(TRIM(CONCAT(st.first_name, ' ', st.last_name)), '')       AS observer_name
       FROM   ${schema}.observations o
       JOIN   ${schema}.students s      ON s.id  = o.student_id
       JOIN   ${schema}.obs_milestones m ON m.id  = o.milestone_id
       JOIN   ${schema}.obs_domains d    ON d.id  = o.domain_id
       LEFT JOIN ${schema}.staff st     ON st.id = o.observed_by
       ${where}
       ORDER  BY o.observed_on DESC, d.sort_order, m.sort_order
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    return {
      data: rows,
      meta: { total: parseInt(countRow.total), page, limit, totalPages: Math.ceil(parseInt(countRow.total) / limit) },
    };
  }

  async updateMilestone(schema: string, id: string, dto: Partial<import('./observations.types.js').CreateMilestoneDto>): Promise<any> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (dto.name        !== undefined) { fields.push(`name = $${i++}`);        values.push(dto.name); }
    if (dto.description !== undefined) { fields.push(`description = $${i++}`); values.push(dto.description); }
    if (dto.code        !== undefined) { fields.push(`code = $${i++}`);        values.push(dto.code); }
    if (dto.age_min     !== undefined) { fields.push(`age_min = $${i++}`);     values.push(dto.age_min); }
    if (dto.age_max     !== undefined) { fields.push(`age_max = $${i++}`);     values.push(dto.age_max); }
    if (dto.sort_order  !== undefined) { fields.push(`sort_order = $${i++}`);  values.push(dto.sort_order); }
    if (!fields.length) throw new Error('No fields to update');
    values.push(id);
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.obs_milestones SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!row) throw new Error('Milestone not found');
    return row;
  }

  async deleteMilestone(schema: string, id: string): Promise<void> {
    const [usage] = await tenantQuery<any>(schema,
      `SELECT COUNT(*)::int AS count FROM ${schema}.observations WHERE milestone_id = $1`, [id]);
    if (parseInt(usage.count) > 0)
      throw new Error('Cannot delete — ' + usage.count + ' observation(s) reference this milestone.');
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.obs_milestones SET is_active = false WHERE id = $1 RETURNING id`, [id]);
    if (!row) throw new Error('Milestone not found');
  }
}

export const observationsService = new ObservationsService();
