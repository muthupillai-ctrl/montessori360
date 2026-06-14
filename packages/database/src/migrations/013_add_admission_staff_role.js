exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          ALTER TABLE %I.staff
            DROP CONSTRAINT IF EXISTS staff_role_check;
          ALTER TABLE %I.staff
            ADD CONSTRAINT staff_role_check CHECK (role IN (
              'owner','principal','teacher',
              'assistant_teacher','accountant','driver','support',
              'admission_staff'
            ));
        $$, t.schema_name, t.schema_name);
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
        EXECUTE format($$
          ALTER TABLE %I.staff
            DROP CONSTRAINT IF EXISTS staff_role_check;
          ALTER TABLE %I.staff
            ADD CONSTRAINT staff_role_check CHECK (role IN (
              'owner','principal','teacher',
              'assistant_teacher','accountant','driver','support'
            ));
        $$, t.schema_name, t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
