exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        EXECUTE format($$
          ALTER TABLE %I.fee_invoices
            ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20)
              NOT NULL DEFAULT 'adhoc'
              CHECK (invoice_type IN ('fee_structure','transport','adhoc'));
        $$, t.schema_name);

        -- Backfill existing invoices
        EXECUTE format($$
          UPDATE %I.fee_invoices
          SET invoice_type = CASE
            WHEN fee_structure_id IS NOT NULL THEN 'fee_structure'
            ELSE 'adhoc'
          END
          WHERE invoice_type = 'adhoc';
        $$, t.schema_name);

        -- Unique constraint: one fee_structure invoice per student+period+structure
        EXECUTE format($$
          CREATE UNIQUE INDEX IF NOT EXISTS uq_%s_invoice_structure
            ON %I.fee_invoices (student_id, billing_period, fee_structure_id)
            WHERE invoice_type = 'fee_structure' AND fee_structure_id IS NOT NULL;
        $$, replace(t.schema_name,'-','_'), t.schema_name);

        -- Unique constraint: one transport invoice per student+period
        EXECUTE format($$
          CREATE UNIQUE INDEX IF NOT EXISTS uq_%s_invoice_transport
            ON %I.fee_invoices (student_id, billing_period)
            WHERE invoice_type = 'transport';
        $$, replace(t.schema_name,'-','_'), t.schema_name);

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
        EXECUTE format('DROP INDEX IF EXISTS uq_%s_invoice_structure', replace(t.schema_name,'-','_'));
        EXECUTE format('DROP INDEX IF EXISTS uq_%s_invoice_transport', replace(t.schema_name,'-','_'));
        EXECUTE format('ALTER TABLE %I.fee_invoices DROP COLUMN IF EXISTS invoice_type', t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
