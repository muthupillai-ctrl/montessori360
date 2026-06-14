exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Drop existing index (created by 021)
        EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(t.schema_name) || '.idx_' || replace(t.schema_name, '-', '_') || '_classes_name_section';

        -- Delete duplicates using CTE
        EXECUTE '
          WITH ranked AS (
            SELECT c.id,
                   ROW_NUMBER() OVER (
                     PARTITION BY c.name, COALESCE(c.section, '''')
                     ORDER BY COUNT(s.id) DESC, c.created_at ASC
                   ) AS rn
            FROM ' || quote_ident(t.schema_name) || '.classes c
            LEFT JOIN ' || quote_ident(t.schema_name) || '.students s
              ON s.class_id = c.id AND s.is_active = true
            GROUP BY c.id
          )
          DELETE FROM ' || quote_ident(t.schema_name) || '.classes
          WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
        ';

        -- Recreate unique index
        EXECUTE '
          CREATE UNIQUE INDEX idx_' || replace(t.schema_name, '-', '_') || '_classes_name_section
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
        EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(t.schema_name) || '.idx_' || replace(t.schema_name, '-', '_') || '_classes_name_section';
      END LOOP;
    END $outer$;
  `);
};
