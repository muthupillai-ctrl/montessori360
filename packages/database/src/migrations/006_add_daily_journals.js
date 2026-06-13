exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.daily_journals (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            student_id   UUID NOT NULL,
            journal_date DATE NOT NULL,
            meal         JSONB NOT NULL DEFAULT '{}',
            nap          JSONB NOT NULL DEFAULT '{}',
            toilet       JSONB NOT NULL DEFAULT '{"count":0}',
            activities   JSONB NOT NULL DEFAULT '[]',
            mood         VARCHAR(20) CHECK (mood IN ('happy','calm','unsettled','upset')),
            mood_note    TEXT,
            homework     JSONB NOT NULL DEFAULT '[]',
            teacher_note TEXT,
            published_at TIMESTAMPTZ,
            created_by   UUID,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(student_id, journal_date)
          )
        $$, t.schema_name);

        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_journals_student ON %I.daily_journals(student_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_journals_date ON %I.daily_journals(journal_date DESC)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

      END LOOP;
    END;
    $outer$
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.daily_journals', t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
