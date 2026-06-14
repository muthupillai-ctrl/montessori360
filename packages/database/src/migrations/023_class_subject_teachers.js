exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        EXECUTE '
          CREATE TABLE IF NOT EXISTS ' || quote_ident(t.schema_name) || '.class_subject_teachers (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            class_id    UUID NOT NULL REFERENCES ' || quote_ident(t.schema_name) || '.classes(id) ON DELETE CASCADE,
            subject_id  UUID NOT NULL REFERENCES ' || quote_ident(t.schema_name) || '.subjects(id) ON DELETE CASCADE,
            teacher_id  UUID REFERENCES ' || quote_ident(t.schema_name) || '.staff(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        ';

        EXECUTE '
          CREATE UNIQUE INDEX IF NOT EXISTS idx_' || replace(t.schema_name,'-','_') || '_cst_class_subject
          ON ' || quote_ident(t.schema_name) || '.class_subject_teachers(class_id, subject_id)
        ';

        EXECUTE '
          CREATE INDEX IF NOT EXISTS idx_' || replace(t.schema_name,'-','_') || '_cst_teacher
          ON ' || quote_ident(t.schema_name) || '.class_subject_teachers(teacher_id)
        ';

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
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(t.schema_name) || '.class_subject_teachers CASCADE';
      END LOOP;
    END $outer$;
  `);
};
