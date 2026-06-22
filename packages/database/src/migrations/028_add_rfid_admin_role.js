/**
 * 028 — Add rfid_admin to staff role CHECK constraint.
 *
 * rfid_admin is a service account role used by the standalone RFID Attendance
 * system. It has read-only access to students and can mark attendance via API.
 * It has no access to any other school data.
 */

exports.up = async ({ sql }) => {
  sql(`
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
              'admission_staff','rfid_admin'
            ));
        $$, t.schema_name, t.schema_name);
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
