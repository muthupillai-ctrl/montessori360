exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$

          CREATE TABLE IF NOT EXISTS %I.student_parents (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            student_id      UUID NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
            relation        VARCHAR(20) NOT NULL CHECK (relation IN ('father','mother','guardian','step_father','step_mother','other')),
            first_name      VARCHAR(100) NOT NULL,
            last_name       VARCHAR(100) NOT NULL,
            email           VARCHAR(255),
            mobile          VARCHAR(20),
            mobile_alt      VARCHAR(20),
            profession      VARCHAR(100),
            employer        VARCHAR(150),
            annual_income   NUMERIC(12,2),
            education       VARCHAR(100),
            is_primary      BOOLEAN NOT NULL DEFAULT false,
            can_pickup      BOOLEAN NOT NULL DEFAULT true,
            notes           TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          CREATE INDEX IF NOT EXISTS %I ON %I.student_parents(student_id);
          CREATE INDEX IF NOT EXISTS %I ON %I.student_parents(email) WHERE email IS NOT NULL;

        $$,
        t.schema_name, t.schema_name,
        t.schema_name || '_sp_student_idx', t.schema_name,
        t.schema_name || '_sp_email_idx',   t.schema_name
        );
      END LOOP;
    END $outer$;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.student_parents CASCADE', t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
