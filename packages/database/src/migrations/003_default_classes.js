/**
 * Migration: 003_default_classes
 *
 * Adds a helper function to seed default Montessori classes
 * into a newly provisioned tenant schema.
 *
 * Usage after provisioning a tenant:
 *   SELECT seed_default_classes('tenant_testschool');
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.seed_default_classes(p_schema text)
    RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      EXECUTE format($sql$
        INSERT INTO %I.classes (name, age_group_min, age_group_max, capacity) VALUES
          ('Toddler (18m–3y)',  1, 3,  15),
          ('Casa 1 (3–4y)',     3, 4,  20),
          ('Casa 2 (4–5y)',     4, 5,  20),
          ('Casa 3 (5–6y)',     5, 6,  20),
          ('Lower Elementary (6–9y)', 6, 9, 25)
        ON CONFLICT DO NOTHING
      $sql$, p_schema);
    END;
    $$;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS public.seed_default_classes(text)');
};
