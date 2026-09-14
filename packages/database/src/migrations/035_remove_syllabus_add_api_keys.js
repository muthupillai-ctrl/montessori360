exports.up = async ({ sql }) => {

  // 1 — Drop syllabus tables from every tenant schema
  sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$ DROP TABLE IF EXISTS %I.syllabus_topics CASCADE $$, t.schema_name);
      END LOOP;
    END $outer$;
  `);

  // 2 — Create API keys table in public schema
  sql(`
    CREATE TABLE IF NOT EXISTS public.api_keys (
      id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      key_prefix   VARCHAR(12) NOT NULL,
      key_hash     VARCHAR(64) NOT NULL UNIQUE,
      name         VARCHAR(100) NOT NULL,
      tenant_schema VARCHAR(100) NOT NULL REFERENCES public.tenants(schema_name) ON DELETE CASCADE,
      created_by   UUID,
      last_used_at TIMESTAMPTZ,
      is_active    BOOLEAN NOT NULL DEFAULT true,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  sql(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON public.api_keys (tenant_schema);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash   ON public.api_keys (key_hash);
  `);
};

exports.down = async ({ sql }) => {
  sql(`DROP TABLE IF EXISTS public.api_keys;`);
};
