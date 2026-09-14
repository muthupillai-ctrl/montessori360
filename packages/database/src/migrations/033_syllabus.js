// Each sql() call is a separate client.query() — fully committed before the next step.

exports.up = async ({ sql }) => {

  // 1 ── Drop any partial tables from previous failed attempts
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$ DROP TABLE IF EXISTS %I.syllabus_topics CASCADE $$, t.schema_name);
        EXECUTE format($$ DROP TABLE IF EXISTS %I.subjects        CASCADE $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);

  // 2 ── Create subjects table
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          CREATE TABLE %I.subjects (
            id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            name         VARCHAR(100) NOT NULL,
            subject_type VARCHAR(20)  NOT NULL DEFAULT 'traditional',
            color        VARCHAR(7)   NOT NULL DEFAULT '#6366F1',
            description  TEXT,
            order_no     INTEGER      NOT NULL DEFAULT 0,
            is_active    BOOLEAN      NOT NULL DEFAULT true,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);

  // 3 ── Indexes on subjects
  sql(`
    DO $outer$
    DECLARE t RECORD; iname TEXT;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        iname := replace(t.schema_name, '-', '_') || '_subjects_uniq';
        EXECUTE format($$ CREATE UNIQUE INDEX %I ON %I.subjects (name, subject_type) $$,
          iname, t.schema_name);
        iname := replace(t.schema_name, '-', '_') || '_subjects_type_idx';
        EXECUTE format($$ CREATE INDEX %I ON %I.subjects (subject_type) $$,
          iname, t.schema_name);
      END LOOP;
    END $outer$;
  `);

  // 4 ── Seed default subjects
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          INSERT INTO %I.subjects (name, subject_type, color, order_no) VALUES
            ('Practical Life',     'montessori',  '#F59E0B',  1),
            ('Sensorial',          'montessori',  '#8B5CF6',  2),
            ('Language',           'montessori',  '#3B82F6',  3),
            ('Mathematics',        'montessori',  '#10B981',  4),
            ('Cultural',           'montessori',  '#EC4899',  5),
            ('English',            'traditional', '#2563EB',  6),
            ('Hindi',              'traditional', '#DC2626',  7),
            ('Mathematics',        'traditional', '#059669',  8),
            ('Science',            'traditional', '#0891B2',  9),
            ('Social Studies',     'traditional', '#7C3AED', 10),
            ('EVS',                'traditional', '#16A34A', 11),
            ('Art & Craft',        'traditional', '#DB2777', 12),
            ('Music',              'traditional', '#9333EA', 13),
            ('Physical Education', 'traditional', '#EA580C', 14)
        $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);

  // 5 ── Create syllabus_topics table
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          CREATE TABLE %I.syllabus_topics (
            id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
            subject_id       UUID         NOT NULL REFERENCES %I.subjects(id)     ON DELETE CASCADE,
            class_id         UUID         REFERENCES %I.classes(id)               ON DELETE SET NULL,
            academic_year_id UUID         REFERENCES %I.academic_years(id)        ON DELETE SET NULL,
            title            VARCHAR(255) NOT NULL,
            description      TEXT,
            order_no         INTEGER      NOT NULL DEFAULT 0,
            status           VARCHAR(20)  NOT NULL DEFAULT 'not_started',
            target_date      DATE,
            completed_at     TIMESTAMPTZ,
            created_by       UUID         REFERENCES %I.staff(id)                 ON DELETE SET NULL,
            created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
          )
        $$, t.schema_name, t.schema_name, t.schema_name, t.schema_name, t.schema_name);
      END LOOP;
    END $outer$;
  `);

  // 6 ── Indexes on syllabus_topics
  sql(`
    DO $outer$
    DECLARE t RECORD; iname TEXT;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        iname := replace(t.schema_name, '-', '_') || '_syllabus_subject_idx';
        EXECUTE format($$ CREATE INDEX %I ON %I.syllabus_topics (subject_id) $$,       iname, t.schema_name);
        iname := replace(t.schema_name, '-', '_') || '_syllabus_class_idx';
        EXECUTE format($$ CREATE INDEX %I ON %I.syllabus_topics (class_id) $$,         iname, t.schema_name);
        iname := replace(t.schema_name, '-', '_') || '_syllabus_year_idx';
        EXECUTE format($$ CREATE INDEX %I ON %I.syllabus_topics (academic_year_id) $$, iname, t.schema_name);
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
        EXECUTE format($$ DROP TABLE IF EXISTS %I.syllabus_topics CASCADE $$, t.schema_name);
        EXECUTE format($$ DROP TABLE IF EXISTS %I.subjects        CASCADE $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
