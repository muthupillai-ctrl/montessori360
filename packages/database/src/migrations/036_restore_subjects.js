// Restores the timetable `subjects` table which was accidentally dropped by
// migrations 033 and 035. Also restores foreign-key constraints on
// timetable_slots and class_subject_teachers that were cascade-dropped.

exports.up = async ({ sql }) => {

  // 1 — Recreate subjects with the original timetable schema in every tenant
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.subjects (
            id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            name        VARCHAR(100) NOT NULL,
            code        VARCHAR(20),
            color       VARCHAR(7)   NOT NULL DEFAULT '#2563EB',
            description TEXT,
            is_active   BOOLEAN      NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

      END LOOP;
    END $outer$;
  `);

  // 2 — Clear any dangling subject references (subjects were dropped by 035)
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- timetable_slots.subject_id is nullable — just null it out
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = t.schema_name AND table_name = 'timetable_slots'
        ) THEN
          EXECUTE format($$
            UPDATE %I.timetable_slots SET subject_id = NULL WHERE subject_id IS NOT NULL
          $$, t.schema_name);
        END IF;

        -- class_subject_teachers.subject_id is NOT NULL — delete orphaned rows
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = t.schema_name AND table_name = 'class_subject_teachers'
        ) THEN
          EXECUTE format($$
            DELETE FROM %I.class_subject_teachers
          $$, t.schema_name);
        END IF;

      END LOOP;
    END $outer$;
  `);

  // 3 — Restore FK constraint on timetable_slots -> subjects
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = t.schema_name AND table_name = 'timetable_slots'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class cl ON cl.oid = c.conrelid
          JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          WHERE ns.nspname = t.schema_name
            AND cl.relname = 'timetable_slots'
            AND c.contype = 'f'
            AND c.conname = 'fk_timetable_slots_subject'
        ) THEN
          EXECUTE format($$
            ALTER TABLE %I.timetable_slots
            ADD CONSTRAINT fk_timetable_slots_subject
            FOREIGN KEY (subject_id) REFERENCES %I.subjects(id) ON DELETE SET NULL
          $$, t.schema_name, t.schema_name);
        END IF;

      END LOOP;
    END $outer$;
  `);

  // 4 — Restore FK constraint on class_subject_teachers -> subjects
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = t.schema_name AND table_name = 'class_subject_teachers'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class cl ON cl.oid = c.conrelid
          JOIN pg_namespace ns ON ns.oid = cl.relnamespace
          WHERE ns.nspname = t.schema_name
            AND cl.relname = 'class_subject_teachers'
            AND c.contype = 'f'
            AND c.conname = 'fk_cst_subject'
        ) THEN
          EXECUTE format($$
            ALTER TABLE %I.class_subject_teachers
            ADD CONSTRAINT fk_cst_subject
            FOREIGN KEY (subject_id) REFERENCES %I.subjects(id) ON DELETE CASCADE
          $$, t.schema_name, t.schema_name);
        END IF;

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
        EXECUTE format($$ DROP TABLE IF EXISTS %I.subjects CASCADE $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
