/**
 * 027 — Add unique constraint on (student_id, email) in student_parents.
 * Prevents the same email being added twice as a parent for the same student.
 * Cross-student duplicates (siblings) are intentionally allowed.
 */
import pgPromise from 'pg-promise';

const pgp = pgPromise();

export async function up(db) {
  // Get all tenant schemas
  const tenants = await db.any(
    `SELECT schema_name FROM public.tenants WHERE is_active = true`
  );

  for (const { schema_name } of tenants) {
    // Remove any existing duplicate (student_id, email) rows, keeping the oldest
    await db.none(`
      DELETE FROM ${schema_name}.student_parents
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY student_id, email ORDER BY created_at) AS rn
          FROM   ${schema_name}.student_parents
          WHERE  email IS NOT NULL
        ) t
        WHERE rn > 1
      )
    `);

    // Add unique constraint (partial — only where email is not null)
    await db.none(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_${schema_name.replace(/-/g, '_')}_sp_student_email
      ON ${schema_name}.student_parents (student_id, email)
      WHERE email IS NOT NULL
    `);
  }
}

export async function down(db) {
  const tenants = await db.any(
    `SELECT schema_name FROM public.tenants WHERE is_active = true`
  );

  for (const { schema_name } of tenants) {
    await db.none(`
      DROP INDEX IF EXISTS ${schema_name}.idx_${schema_name.replace(/-/g, '_')}_sp_student_email
    `);
  }
}
