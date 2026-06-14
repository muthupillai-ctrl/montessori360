exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Clean up any partial tables from previous failed attempts
        EXECUTE format('DROP TABLE IF EXISTS %I.timetable_slots  CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.timetables        CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.template_slots    CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.period_templates  CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.subjects          CASCADE', t.schema_name);

        -- subjects
        EXECUTE format($$
          CREATE TABLE %I.subjects (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name        VARCHAR(100) NOT NULL,
            code        VARCHAR(20),
            color       VARCHAR(7) NOT NULL DEFAULT '#2563EB',
            description TEXT,
            is_active   BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- period_templates
        EXECUTE format($$
          CREATE TABLE %I.period_templates (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name        VARCHAR(100) NOT NULL,
            description TEXT,
            is_default  BOOLEAN NOT NULL DEFAULT false,
            is_active   BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- template_slots
        EXECUTE format($$
          CREATE TABLE %I.template_slots (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            template_id UUID NOT NULL REFERENCES %I.period_templates(id) ON DELETE CASCADE,
            name        VARCHAR(100) NOT NULL,
            slot_type   VARCHAR(20) NOT NULL DEFAULT 'period'
                          CHECK (slot_type IN ('period','work_cycle','break','assembly','other')),
            start_time  TIME NOT NULL,
            end_time    TIME NOT NULL,
            sort_order  INT NOT NULL DEFAULT 0,
            color       VARCHAR(7),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name, t.schema_name);

        EXECUTE format(
          'CREATE INDEX idx_%s_tpl_slots_tpl ON %I.template_slots(template_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- timetables
        EXECUTE format($$
          CREATE TABLE %I.timetables (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            class_id      UUID NOT NULL REFERENCES %I.classes(id) ON DELETE CASCADE,
            academic_year VARCHAR(20) NOT NULL,
            name          VARCHAR(100),
            mon_template  UUID REFERENCES %I.period_templates(id),
            tue_template  UUID REFERENCES %I.period_templates(id),
            wed_template  UUID REFERENCES %I.period_templates(id),
            thu_template  UUID REFERENCES %I.period_templates(id),
            fri_template  UUID REFERENCES %I.period_templates(id),
            sat_template  UUID REFERENCES %I.period_templates(id),
            is_active     BOOLEAN NOT NULL DEFAULT true,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name, t.schema_name,
            t.schema_name, t.schema_name, t.schema_name,
            t.schema_name, t.schema_name, t.schema_name);

        EXECUTE format(
          'CREATE UNIQUE INDEX idx_%s_tt_class_year ON %I.timetables(class_id, academic_year)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- timetable_slots (no inline UNIQUE — added as separate index)
        EXECUTE format($$
          CREATE TABLE %I.timetable_slots (
            id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            timetable_id         UUID NOT NULL REFERENCES %I.timetables(id) ON DELETE CASCADE,
            template_slot_id     UUID NOT NULL REFERENCES %I.template_slots(id) ON DELETE CASCADE,
            day_of_week          SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
            subject_id           UUID REFERENCES %I.subjects(id),
            teacher_id           UUID REFERENCES %I.staff(id),
            slot_type            VARCHAR(20) NOT NULL DEFAULT 'period'
                                   CHECK (slot_type IN ('period','work_cycle','break','assembly','free','other')),
            notes                TEXT,
            conflict_approved    BOOLEAN NOT NULL DEFAULT false,
            conflict_approved_by UUID REFERENCES %I.staff(id),
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name, t.schema_name, t.schema_name,
            t.schema_name, t.schema_name, t.schema_name);

        EXECUTE format(
          'CREATE UNIQUE INDEX idx_%s_tt_slots_uniq ON %I.timetable_slots(timetable_id, template_slot_id, day_of_week)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        EXECUTE format(
          'CREATE INDEX idx_%s_tt_slots_teacher ON %I.timetable_slots(teacher_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

      END LOOP;
    END $outer$;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.timetable_slots  CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.timetables        CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.template_slots    CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.period_templates  CASCADE', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.subjects          CASCADE', t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
