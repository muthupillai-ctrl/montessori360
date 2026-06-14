import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheGet, cacheSet, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  PromotionBatchRow, StudentEnrollmentRow,
  ClassMappingEntry, PreparePromotionDto, ExecutePromotionDto,
  PromotionPreview, ClassPromotionPreview, StudentPreviewRow,
} from './promotion.types.js';

const CACHE_TTL = 300;

class PromotionService {

  // ── Preview — validate mappings and count students ────────────────────────

  async prepare(schema: string, dto: PreparePromotionDto): Promise<PromotionPreview> {
    const { from_academic_year_id, to_academic_year_id, class_mapping } = dto;

    const [fromYear] = await tenantQuery<{ id: string; name: string }>(
      schema, `SELECT id, name FROM ${schema}.academic_years WHERE id = $1`, [from_academic_year_id]
    );
    if (!fromYear) throw AppError.notFound('Source academic year');

    const [toYear] = await tenantQuery<{ id: string; name: string }>(
      schema, `SELECT id, name FROM ${schema}.academic_years WHERE id = $1`, [to_academic_year_id]
    );
    if (!toYear) throw AppError.notFound('Target academic year');

    if (from_academic_year_id === to_academic_year_id) {
      throw AppError.badRequest('Source and target academic year must be different');
    }

    // Check target year has no existing promotion batch
    const [existingBatch] = await tenantQuery(
      schema,
      `SELECT id FROM ${schema}.promotion_batches
       WHERE to_academic_year_id = $1 AND status = 'completed'`,
      [to_academic_year_id]
    );
    const global_warnings: string[] = [];
    if (existingBatch) {
      global_warnings.push(`A promotion to ${toYear.name} has already been completed. Executing again will re-assign students.`);
    }

    // Check all mapped class IDs exist
    const allClassIds = [
      ...class_mapping.map(m => m.from_class_id),
      ...class_mapping.filter(m => m.to_class_id).map(m => m.to_class_id as string),
    ];
    const existingClasses = await tenantQuery<{ id: string; name: string; section: string | null }>(
      schema,
      `SELECT id, name, section FROM ${schema}.classes WHERE id = ANY($1::uuid[]) AND is_active = true`,
      [allClassIds]
    );
    const classMap = new Map(existingClasses.map(c => [c.id, c]));

    const classes: ClassPromotionPreview[] = [];
    let totalStudents = 0;

    for (const mapping of class_mapping) {
      const fromClass = classMap.get(mapping.from_class_id);
      if (!fromClass) throw AppError.badRequest(`Class ${mapping.from_class_id} not found`);

      const toClass = mapping.to_class_id ? classMap.get(mapping.to_class_id) : null;
      if (mapping.to_class_id && !toClass) {
        throw AppError.badRequest(`Target class ${mapping.to_class_id} not found`);
      }

      // Get students in this class for the from-year
      const students = await tenantQuery<{
        id: string; admission_no: string; first_name: string; last_name: string;
        outstanding_fees: string;
      }>(
        schema,
        `SELECT s.id, s.admission_no, s.first_name, s.last_name,
                COALESCE(SUM(CASE WHEN fi.status IN ('pending','partial','overdue') THEN fi.total - fi.paid_amount ELSE 0 END), 0)::text AS outstanding_fees
         FROM   ${schema}.students s
         LEFT JOIN ${schema}.fee_invoices fi ON fi.student_id = s.id
         WHERE  s.class_id = $1 AND s.is_active = true
         GROUP  BY s.id, s.admission_no, s.first_name, s.last_name
         ORDER  BY s.first_name, s.last_name`,
        [mapping.from_class_id]
      );

      const studentPreviews: StudentPreviewRow[] = students.map(s => {
        const outstanding = parseFloat(s.outstanding_fees);
        const warnings: string[] = [];
        if (outstanding > 0) warnings.push(`Outstanding fees: ₹${outstanding.toLocaleString('en-IN')}`);
        return {
          id: s.id,
          admission_no: s.admission_no,
          first_name: s.first_name,
          last_name: s.last_name,
          outstanding_fees: outstanding,
          warnings,
        };
      });

      const classWarnings: string[] = [];
      if (!mapping.to_class_id) {
        classWarnings.push('Students will be marked as graduated (no target class)');
      }

      // Check target class capacity if promoting (not graduating)
      if (toClass) {
        const [capacityRow] = await tenantQuery<{ capacity: number; enrolled: string }>(
          schema,
          `SELECT c.capacity, COUNT(s.id)::text AS enrolled
           FROM   ${schema}.classes c
           LEFT JOIN ${schema}.students s ON s.class_id = c.id AND s.is_active = true
           WHERE  c.id = $1
           GROUP  BY c.capacity`,
          [toClass.id]
        );
        if (capacityRow) {
          const available = capacityRow.capacity - parseInt(capacityRow.enrolled);
          if (students.length > available) {
            classWarnings.push(`Target class capacity exceeded: ${students.length} students → ${available} available seats in ${toClass.name}`);
          }
        }
      }

      classes.push({
        from_class_id: mapping.from_class_id,
        from_class_name: fromClass.section ? `${fromClass.name} (${fromClass.section})` : fromClass.name,
        to_class_id: mapping.to_class_id ?? null,
        to_class_name: toClass
          ? (toClass.section ? `${toClass.name} (${toClass.section})` : toClass.name)
          : null,
        student_count: students.length,
        warnings: classWarnings,
        students: studentPreviews,
      });

      totalStudents += students.length;
    }

    return { from_year: fromYear.name, to_year: toYear.name, total_students: totalStudents, classes, global_warnings };
  }

  // ── Execute bulk promotion ────────────────────────────────────────────────

  async execute(schema: string, dto: ExecutePromotionDto, executedBy: string): Promise<PromotionBatchRow> {
    const { from_academic_year_id, to_academic_year_id, class_mapping } = dto;

    // Validate years exist
    const [fromYear] = await tenantQuery<{ id: string; name: string }>(
      schema, `SELECT id, name FROM ${schema}.academic_years WHERE id = $1`, [from_academic_year_id]
    );
    if (!fromYear) throw AppError.notFound('Source academic year');

    const [toYear] = await tenantQuery<{ id: string; name: string }>(
      schema, `SELECT id, name FROM ${schema}.academic_years WHERE id = $1`, [to_academic_year_id]
    );
    if (!toYear) throw AppError.notFound('Target academic year');

    return tenantTransaction(schema, async (client) => {
      // Create batch record
      const { rows: [batch] } = await client.query(
        `INSERT INTO ${schema}.promotion_batches
           (from_academic_year_id, to_academic_year_id, class_mapping, status, created_by, started_at)
         VALUES ($1,$2,$3,'in_progress',$4,now())
         RETURNING *`,
        [from_academic_year_id, to_academic_year_id, JSON.stringify(class_mapping), executedBy]
      );

      let promotedCount = 0;
      let graduatedCount = 0;
      let skippedCount = 0;
      const errors: { student_id: string; student_name: string; reason: string }[] = [];

      for (const mapping of class_mapping) {
        // Get all active students in source class
        const { rows: students } = await client.query(
          `SELECT id, first_name, last_name FROM ${schema}.students
           WHERE class_id = $1 AND is_active = true`,
          [mapping.from_class_id]
        );

        for (const student of students) {
          try {
            if (mapping.to_class_id) {
              // Promote to new class
              await client.query(
                `UPDATE ${schema}.students SET class_id = $1, updated_at = now() WHERE id = $2`,
                [mapping.to_class_id, student.id]
              );

              // Upsert enrollment record for target year
              await client.query(
                `INSERT INTO ${schema}.student_enrollments
                   (student_id, academic_year_id, class_id, promoted_from_class_id, promoted_at)
                 VALUES ($1,$2,$3,$4,now())
                 ON CONFLICT (student_id, academic_year_id) DO UPDATE
                   SET class_id = EXCLUDED.class_id,
                       promoted_from_class_id = EXCLUDED.promoted_from_class_id,
                       promoted_at = now()`,
                [student.id, to_academic_year_id, mapping.to_class_id, mapping.from_class_id]
              );

              promotedCount++;
            } else {
              // Graduate — deactivate student
              await client.query(
                `UPDATE ${schema}.students SET is_active = false, updated_at = now() WHERE id = $1`,
                [student.id]
              );
              graduatedCount++;
            }

            // Audit log
            await client.query(
              `INSERT INTO ${schema}.audit_logs (actor_id, actor_type, action, entity, entity_id, delta)
               VALUES ($1,'staff','BULK_PROMOTE','students',$2,$3)`,
              [
                executedBy, student.id,
                JSON.stringify({
                  batch_id: batch.id,
                  from_class: mapping.from_class_id,
                  to_class: mapping.to_class_id ?? 'graduated',
                  academic_year: toYear.name,
                }),
              ]
            );
          } catch (err: any) {
            errors.push({
              student_id: student.id,
              student_name: `${student.first_name} ${student.last_name}`,
              reason: err?.message ?? 'Unknown error',
            });
            skippedCount++;
          }
        }
      }

      // Mark target year as current
      await client.query(`UPDATE ${schema}.academic_years SET is_current = false`);
      await client.query(
        `UPDATE ${schema}.academic_years SET is_current = true, updated_at = now() WHERE id = $1`,
        [to_academic_year_id]
      );

      // Update batch with results
      const finalStatus = errors.length > 0 && promotedCount + graduatedCount === 0 ? 'failed' : 'completed';
      const { rows: [updatedBatch] } = await client.query(
        `UPDATE ${schema}.promotion_batches SET
           status = $1, total_students = $2, promoted_count = $3,
           graduated_count = $4, skipped_count = $5, errors = $6, completed_at = now()
         WHERE id = $7
         RETURNING *`,
        [
          finalStatus,
          promotedCount + graduatedCount + skippedCount,
          promotedCount, graduatedCount, skippedCount,
          JSON.stringify(errors),
          batch.id,
        ]
      );

      await cacheDelPattern(`${schema}:students:*`);
      await cacheDelPattern(`${schema}:calendar:years`);
      await cacheDelPattern(`${schema}:promotion:*`);

      return updatedBatch as PromotionBatchRow;
    });
  }

  // ── List promotion batches ────────────────────────────────────────────────

  async listBatches(schema: string): Promise<PromotionBatchRow[]> {
    const cacheKey = `${schema}:promotion:batches`;
    const cached = await cacheGet<PromotionBatchRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<PromotionBatchRow>(
      schema,
      `SELECT pb.*,
              fy.name  AS from_year_name,
              ty.name  AS to_year_name,
              NULLIF(TRIM(CONCAT(st.first_name,' ',st.last_name)),'') AS created_by_name
       FROM   ${schema}.promotion_batches pb
       JOIN   ${schema}.academic_years fy ON fy.id = pb.from_academic_year_id
       JOIN   ${schema}.academic_years ty ON ty.id = pb.to_academic_year_id
       LEFT JOIN ${schema}.staff st ON st.id = pb.created_by
       ORDER  BY pb.created_at DESC`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  // ── Enrollment history for a student ─────────────────────────────────────

  async getStudentEnrollments(schema: string, studentId: string): Promise<StudentEnrollmentRow[]> {
    const cacheKey = `${schema}:promotion:enrollments:${studentId}`;
    const cached = await cacheGet<StudentEnrollmentRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<StudentEnrollmentRow>(
      schema,
      `SELECT se.*,
              ay.name  AS academic_year_name,
              c.name   AS class_name,
              c.section,
              fc.name  AS from_class_name
       FROM   ${schema}.student_enrollments se
       JOIN   ${schema}.academic_years ay ON ay.id = se.academic_year_id
       JOIN   ${schema}.classes c         ON c.id  = se.class_id
       LEFT JOIN ${schema}.classes fc     ON fc.id = se.promoted_from_class_id
       WHERE  se.student_id = $1
       ORDER  BY ay.start_date DESC`,
      [studentId]
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  // ── Enrollments for a class in a given year ───────────────────────────────

  async getClassEnrollments(schema: string, classId: string, academicYearId: string): Promise<any[]> {
    return tenantQuery(
      schema,
      `SELECT se.*, s.first_name, s.last_name, s.admission_no
       FROM   ${schema}.student_enrollments se
       JOIN   ${schema}.students s ON s.id = se.student_id
       WHERE  se.class_id = $1 AND se.academic_year_id = $2
       ORDER  BY s.first_name, s.last_name`,
      [classId, academicYearId]
    );
  }
}

export const promotionService = new PromotionService();
