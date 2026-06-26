exports.up = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          ALTER TABLE %I.students
            ADD COLUMN IF NOT EXISTS mother_tongue VARCHAR(100);
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
        EXECUTE format($$
          ALTER TABLE %I.students
            DROP COLUMN IF EXISTS mother_tongue;
        $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
