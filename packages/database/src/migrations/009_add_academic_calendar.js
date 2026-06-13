exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- academic_years
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.academic_years (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name         VARCHAR(20) NOT NULL UNIQUE,
            start_date   DATE NOT NULL,
            end_date     DATE NOT NULL,
            is_current   BOOLEAN NOT NULL DEFAULT false,
            working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- terms
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.terms (
            id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            academic_year_id UUID NOT NULL,
            name             VARCHAR(50) NOT NULL,
            start_date       DATE NOT NULL,
            end_date         DATE NOT NULL,
            sort_order       INTEGER NOT NULL DEFAULT 1,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_terms_year ON %I.terms(academic_year_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- calendar_events
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.calendar_events (
            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title               VARCHAR(255) NOT NULL,
            description         TEXT,
            event_type          VARCHAR(20) NOT NULL CHECK (event_type IN (
                                  'holiday','exam','event','meeting',
                                  'excursion','closure','term_start','term_end','other')),
            start_date          DATE NOT NULL,
            end_date            DATE NOT NULL,
            is_all_day          BOOLEAN NOT NULL DEFAULT true,
            start_time          VARCHAR(5),
            end_time            VARCHAR(5),
            affects_attendance  BOOLEAN NOT NULL DEFAULT false,
            class_ids           UUID[] DEFAULT '{}',
            recurrence          VARCHAR(10) NOT NULL DEFAULT 'none'
                                  CHECK (recurrence IN ('none','weekly','monthly','yearly')),
            colour              VARCHAR(7) NOT NULL DEFAULT '#2E5AA8',
            created_by          UUID,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_events_dates ON %I.calendar_events(start_date, end_date)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_events_type ON %I.calendar_events(event_type)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- timetable_slots
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.timetable_slots (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            class_id    UUID NOT NULL,
            day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
            start_time  VARCHAR(5) NOT NULL,
            end_time    VARCHAR(5) NOT NULL,
            subject     VARCHAR(100) NOT NULL,
            teacher_id  UUID,
            room        VARCHAR(50),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_timetable_class ON %I.timetable_slots(class_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- Seed current academic year
        EXECUTE format($$
          INSERT INTO %I.academic_years (name, start_date, end_date, is_current)
          VALUES ('2025-2026', '2025-06-01', '2026-03-31', true)
          ON CONFLICT (name) DO NOTHING
        $$, t.schema_name);

        -- Seed 3 terms
        EXECUTE format($$
          INSERT INTO %I.terms (academic_year_id, name, start_date, end_date, sort_order)
          SELECT id, 'Term 1', '2025-06-01', '2025-09-30', 1
          FROM   %I.academic_years WHERE name = '2025-2026'
          ON CONFLICT DO NOTHING
        $$, t.schema_name, t.schema_name);

        EXECUTE format($$
          INSERT INTO %I.terms (academic_year_id, name, start_date, end_date, sort_order)
          SELECT id, 'Term 2', '2025-10-01', '2025-12-31', 2
          FROM   %I.academic_years WHERE name = '2025-2026'
          ON CONFLICT DO NOTHING
        $$, t.schema_name, t.schema_name);

        EXECUTE format($$
          INSERT INTO %I.terms (academic_year_id, name, start_date, end_date, sort_order)
          SELECT id, 'Term 3', '2026-01-01', '2026-03-31', 3
          FROM   %I.academic_years WHERE name = '2025-2026'
          ON CONFLICT DO NOTHING
        $$, t.schema_name, t.schema_name);

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
        EXECUTE format('DROP TABLE IF EXISTS %I.timetable_slots', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.calendar_events', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.terms', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.academic_years', t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
