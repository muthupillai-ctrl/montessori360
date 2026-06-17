/**
 * Migration 026: Add homework_tasks table.
 *
 * Idempotent: safe to re-run after a partial failure.
 * Uses $fn$/$q$ dollar-quote tags to avoid nesting conflict with the outer $$.
 */

const HOMEWORK_DDL = `
  CREATE TABLE IF NOT EXISTS %1$I.homework_tasks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    subject       VARCHAR(100),
    class_id      UUID REFERENCES %1$I.classes(id)  ON DELETE CASCADE,
    student_id    UUID REFERENCES %1$I.students(id) ON DELETE CASCADE,
    due_date      DATE NOT NULL,
    assigned_by   UUID REFERENCES %1$I.staff(id)    ON DELETE SET NULL,
    is_published  BOOLEAN NOT NULL DEFAULT false,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT homework_target_check
      CHECK (class_id IS NOT NULL OR student_id IS NOT NULL)
  );
  CREATE INDEX IF NOT EXISTS %2$I ON %1$I.homework_tasks(class_id)   WHERE class_id   IS NOT NULL;
  CREATE INDEX IF NOT EXISTS %3$I ON %1$I.homework_tasks(student_id) WHERE student_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS %4$I ON %1$I.homework_tasks(due_date DESC);
`;

exports.up = async (pgm) => {

  // ── 1. Rename current function (skip if already renamed by a prior run) ───
  pgm.sql(`
    DO $rename$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'create_tenant_schema'
      ) THEN
        ALTER FUNCTION public.create_tenant_schema(text) RENAME TO create_tenant_schema_v25;
      END IF;
    END $rename$;
  `);

  // ── 2. New wrapper function ───────────────────────────────────────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.create_tenant_schema(p_schema text)
    RETURNS void LANGUAGE plpgsql AS $fn$
    BEGIN
      PERFORM public.create_tenant_schema_v25(p_schema);

      EXECUTE format($q$${HOMEWORK_DDL}$q$,
        p_schema,
        p_schema || '_hw_class_idx',
        p_schema || '_hw_student_idx',
        p_schema || '_hw_due_idx'
      );
    END;
    $fn$;
  `);

  // ── 3. Add homework_tasks to all existing tenant schemas ──────────────────
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($q$${HOMEWORK_DDL}$q$,
          t.schema_name,
          t.schema_name || '_hw_class_idx',
          t.schema_name || '_hw_student_idx',
          t.schema_name || '_hw_due_idx'
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
        EXECUTE format('DROP TABLE IF EXISTS %I.homework_tasks CASCADE', t.schema_name);
      END LOOP;
    END $outer$;
  `);

  pgm.sql(`
    DROP FUNCTION IF EXISTS public.create_tenant_schema(text);
    ALTER FUNCTION public.create_tenant_schema_v25(text) RENAME TO create_tenant_schema;
  `);
};
