exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Student transport fee record (one per student)
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.student_transport_fees (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            student_id   UUID NOT NULL UNIQUE,
            route_id     UUID NOT NULL,
            monthly_fee  NUMERIC(10,2) NOT NULL,
            is_active    BOOLEAN NOT NULL DEFAULT true,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_stf_student ON %I.student_transport_fees(student_id)',
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
        EXECUTE format('DROP TABLE IF EXISTS %I.student_transport_fees CASCADE', t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
