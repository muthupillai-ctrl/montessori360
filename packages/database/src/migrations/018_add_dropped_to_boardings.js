exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        EXECUTE format($$
          ALTER TABLE %I.trip_boardings
            ADD COLUMN IF NOT EXISTS dropped      BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS dropped_at   TIMESTAMPTZ;
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
        EXECUTE format($$
          ALTER TABLE %I.trip_boardings
            DROP COLUMN IF EXISTS dropped,
            DROP COLUMN IF EXISTS dropped_at;
        $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
