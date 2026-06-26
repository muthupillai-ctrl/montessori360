exports.up = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          ALTER TABLE %I.student_parents
            ADD COLUMN IF NOT EXISTS is_emergency_contact BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS address_line1  VARCHAR(200),
            ADD COLUMN IF NOT EXISTS address_line2  VARCHAR(200),
            ADD COLUMN IF NOT EXISTS city           VARCHAR(100),
            ADD COLUMN IF NOT EXISTS state          VARCHAR(100),
            ADD COLUMN IF NOT EXISTS country        VARCHAR(100),
            ADD COLUMN IF NOT EXISTS pincode        VARCHAR(10);

          -- At most one emergency contact per student
          CREATE UNIQUE INDEX IF NOT EXISTS %I
            ON %I.student_parents (student_id)
            WHERE is_emergency_contact = true;
        $$,
        t.schema_name,
        t.schema_name || '_sp_emergency_uniq',
        t.schema_name);
      END LOOP;
    END $outer$;
  `);
};

exports.down = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          DROP INDEX IF EXISTS %I;
          ALTER TABLE %I.student_parents
            DROP COLUMN IF EXISTS is_emergency_contact,
            DROP COLUMN IF EXISTS address_line1,
            DROP COLUMN IF EXISTS address_line2,
            DROP COLUMN IF EXISTS city,
            DROP COLUMN IF EXISTS state,
            DROP COLUMN IF EXISTS country,
            DROP COLUMN IF EXISTS pincode;
        $$,
        t.schema_name || '_sp_emergency_uniq',
        t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
