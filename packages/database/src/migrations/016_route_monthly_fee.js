exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Add monthly_fee to transport_routes
        EXECUTE format($$
          ALTER TABLE %I.transport_routes
            ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2);
        $$, t.schema_name);

        -- Remove transport_fee from route_students (no longer needed)
        EXECUTE format($$
          ALTER TABLE %I.route_students
            DROP COLUMN IF EXISTS transport_fee;
        $$, t.schema_name);

        -- Drop student_transport_fees table (replaced by route-level fee)
        EXECUTE format($$
          DROP TABLE IF EXISTS %I.student_transport_fees CASCADE;
        $$, t.schema_name);

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
        EXECUTE format('ALTER TABLE %I.transport_routes DROP COLUMN IF EXISTS monthly_fee', t.schema_name);
        EXECUTE format('ALTER TABLE %I.route_students ADD COLUMN IF NOT EXISTS transport_fee NUMERIC(10,2)', t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
