exports.up = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          ALTER TABLE %I.students
            ADD COLUMN IF NOT EXISTS rfid_card_no TEXT;
          CREATE UNIQUE INDEX IF NOT EXISTS %I
            ON %I.students (rfid_card_no)
            WHERE rfid_card_no IS NOT NULL;
        $$, t.schema_name,
            t.schema_name || '_students_rfid_card_no_key',
            t.schema_name);
      END LOOP;
    END $outer$;
  `);
};

exports.down = async ({ sql }) => {
  sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          ALTER TABLE %I.students DROP COLUMN IF EXISTS rfid_card_no;
        $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
