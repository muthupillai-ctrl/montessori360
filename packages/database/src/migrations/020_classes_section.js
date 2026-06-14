exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(t.schema_name) || '.classes
          ADD COLUMN IF NOT EXISTS section VARCHAR(20)';
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
        EXECUTE 'ALTER TABLE ' || quote_ident(t.schema_name) || '.classes
          DROP COLUMN IF EXISTS section';
      END LOOP;
    END $outer$;
  `);
};
