exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Delete duplicate classes keeping the one with the most students (or latest created)
        EXECUTE '
          DELETE FROM ' || quote_ident(t.schema_name) || '.classes
          WHERE id IN (
            SELECT loser FROM (
              SELECT
                id AS loser,
                ROW_NUMBER() OVER (
                  PARTITION BY name, COALESCE(section, '''')
                  ORDER BY enrolled_count DESC, created_at ASC
                ) AS rn
              FROM (
                SELECT c.id, c.name, c.section, c.created_at,
                       COUNT(s.id) AS enrolled_count
                FROM ' || quote_ident(t.schema_name) || '.classes c
                LEFT JOIN ' || quote_ident(t.schema_name) || '.students s
                  ON s.class_id = c.id AND s.is_active = true
                GROUP BY c.id, c.name, c.section, c.created_at
              ) counted
            ) ranked
            WHERE rn > 1
          )
        ';

        -- Add unique index
        EXECUTE '
          CREATE UNIQUE INDEX IF NOT EXISTS idx_' || replace(t.schema_name,'-','_') || '_classes_name_section
          ON ' || quote_ident(t.schema_name) || '.classes(name, COALESCE(section, ''''))
        ';

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
        EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(t.schema_name) || '.idx_' || replace(t.schema_name,''-'',''_'') || ''_classes_name_section''';
      END LOOP;
    END $outer$;
  `);
};
