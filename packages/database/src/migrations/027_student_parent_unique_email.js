/**
 * 027 — Add unique constraint on (student_id, email) in student_parents.
 * Prevents the same email being added twice as a parent for the same student.
 * Cross-student duplicates (siblings) are intentionally allowed.
 */

exports.up = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE
      t RECORD;
      idx_name TEXT;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        -- Remove duplicate (student_id, email) rows, keeping the oldest
        EXECUTE format($$
          DELETE FROM %I.student_parents
          WHERE id IN (
            SELECT id FROM (
              SELECT id,
                     ROW_NUMBER() OVER (PARTITION BY student_id, email ORDER BY created_at) AS rn
              FROM   %I.student_parents
              WHERE  email IS NOT NULL
            ) sub
            WHERE rn > 1
          )
        $$, t.schema_name, t.schema_name);

        -- Add partial unique index (only where email is not null)
        EXECUTE format($$
          CREATE UNIQUE INDEX IF NOT EXISTS %I
          ON %I.student_parents (student_id, email)
          WHERE email IS NOT NULL
        $$,
          'idx_' || replace(t.schema_name, '-', '_') || '_sp_student_email',
          t.schema_name
        );
      END LOOP;
    END $outer$;
  `);
};

exports.down = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          DROP INDEX IF EXISTS %I.%I
        $$,
          t.schema_name,
          'idx_' || replace(t.schema_name, '-', '_') || '_sp_student_email'
        );
      END LOOP;
    END $outer$;
  `);
};
