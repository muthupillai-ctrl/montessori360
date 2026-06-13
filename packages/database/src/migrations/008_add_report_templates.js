exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- report_templates table
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.report_templates (
            id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name             VARCHAR(100) NOT NULL,
            description      TEXT,
            logo_url         TEXT,
            primary_colour   VARCHAR(7) NOT NULL DEFAULT '#1F3864',
            secondary_colour VARCHAR(7) NOT NULL DEFAULT '#2E5AA8',
            accent_colour    VARCHAR(7) NOT NULL DEFAULT '#D6E4F0',
            font             VARCHAR(20) NOT NULL DEFAULT 'helvetica'
                               CHECK (font IN ('helvetica','times','courier')),
            sections         JSONB NOT NULL DEFAULT '[]',
            is_default       BOOLEAN NOT NULL DEFAULT false,
            is_active        BOOLEAN NOT NULL DEFAULT true,
            created_by       UUID,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- Add report_template_id to classes
        EXECUTE format($$
          ALTER TABLE %I.classes
          ADD COLUMN IF NOT EXISTS report_template_id UUID
        $$, t.schema_name);

        -- Seed the built-in default template
        EXECUTE format($$
          INSERT INTO %I.report_templates
            (name, description, is_default, sections)
          VALUES (
            'Default Template',
            'Standard Montessori360 progress card',
            true,
            '[
              {"key":"cover",           "enabled":true,  "order":1},
              {"key":"attendance",      "enabled":true,  "order":2},
              {"key":"mood",            "enabled":true,  "order":3},
              {"key":"domain_progress", "enabled":true,  "order":4},
              {"key":"teacher_note",    "enabled":true,  "order":5},
              {"key":"homework_summary","enabled":false, "order":6},
              {"key":"photo_collage",   "enabled":false, "order":7}
            ]'::jsonb
          )
          ON CONFLICT DO NOTHING
        $$, t.schema_name);

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
        EXECUTE format('ALTER TABLE %I.classes DROP COLUMN IF EXISTS report_template_id', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.report_templates', t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
