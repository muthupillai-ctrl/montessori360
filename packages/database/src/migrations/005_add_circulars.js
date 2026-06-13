exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.circulars (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title        VARCHAR(255) NOT NULL,
            body         TEXT NOT NULL,
            audience     VARCHAR(20) NOT NULL DEFAULT 'all'
                           CHECK (audience IN ('all','staff','parents','class')),
            class_ids    UUID[] DEFAULT '{}',
            attachments  JSONB DEFAULT '[]',
            requires_ack BOOLEAN NOT NULL DEFAULT true,
            published_at TIMESTAMPTZ,
            expires_at   TIMESTAMPTZ,
            created_by   UUID,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_circulars_published ON %I.circulars(published_at DESC)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.circular_acknowledgements (
            id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            circular_id       UUID NOT NULL,
            acknowledged_by   UUID NOT NULL,
            acknowledger_type VARCHAR(10) NOT NULL CHECK (acknowledger_type IN ('staff','parent')),
            acknowledged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(circular_id, acknowledged_by)
          )
        $$, t.schema_name);

        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_circ_acks_circular ON %I.circular_acknowledgements(circular_id)',
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
        EXECUTE format('DROP TABLE IF EXISTS %I.circular_acknowledgements', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.circulars', t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
