exports.up = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          ALTER TABLE %I.classes
            ADD COLUMN IF NOT EXISTS level VARCHAR(20)
              CHECK (level IN ('montessori', 'primary', 'high_school'))
        $$, t.schema_name);
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
        EXECUTE format($$ ALTER TABLE %I.classes DROP COLUMN IF EXISTS level $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
