exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- student_enrollments: one row per student per academic year
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.student_enrollments (
            id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            student_id            UUID NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
            academic_year_id      UUID NOT NULL REFERENCES %I.academic_years(id) ON DELETE CASCADE,
            class_id              UUID NOT NULL REFERENCES %I.classes(id) ON DELETE CASCADE,
            promoted_from_class_id UUID REFERENCES %I.classes(id) ON DELETE SET NULL,
            promoted_at           TIMESTAMPTZ,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(student_id, academic_year_id)
          )
        $$, t.schema_name, t.schema_name, t.schema_name, t.schema_name, t.schema_name);

        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_enrollments_student ON %I.student_enrollments(student_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_enrollments_year ON %I.student_enrollments(academic_year_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_enrollments_class ON %I.student_enrollments(class_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- Backfill enrollments for current academic year from students.class_id
        EXECUTE format($$
          INSERT INTO %I.student_enrollments (student_id, academic_year_id, class_id)
          SELECT s.id, ay.id, s.class_id
          FROM   %I.students s
          CROSS JOIN (SELECT id FROM %I.academic_years WHERE is_current = true LIMIT 1) ay
          WHERE  s.is_active = true AND s.class_id IS NOT NULL
          ON CONFLICT (student_id, academic_year_id) DO NOTHING
        $$, t.schema_name, t.schema_name, t.schema_name);

        -- promotion_batches: tracks each bulk-promote run
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.promotion_batches (
            id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            from_academic_year_id UUID NOT NULL REFERENCES %I.academic_years(id),
            to_academic_year_id   UUID NOT NULL REFERENCES %I.academic_years(id),
            class_mapping         JSONB NOT NULL DEFAULT '[]',
            status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','in_progress','completed','failed')),
            total_students        INT NOT NULL DEFAULT 0,
            promoted_count        INT NOT NULL DEFAULT 0,
            graduated_count       INT NOT NULL DEFAULT 0,
            skipped_count         INT NOT NULL DEFAULT 0,
            errors                JSONB NOT NULL DEFAULT '[]',
            created_by            UUID REFERENCES %I.staff(id) ON DELETE SET NULL,
            started_at            TIMESTAMPTZ,
            completed_at          TIMESTAMPTZ,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name, t.schema_name, t.schema_name, t.schema_name);

        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_promo_batches_from ON %I.promotion_batches(from_academic_year_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_promo_batches_to ON %I.promotion_batches(to_academic_year_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
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
        EXECUTE format('DROP TABLE IF EXISTS %I.promotion_batches CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.student_enrollments CASCADE', t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
