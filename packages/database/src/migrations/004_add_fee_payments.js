exports.up = async (pgm) => {
  // Add fee_payments table to all existing tenant schemas
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.fee_payments (
            id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            invoice_id           UUID NOT NULL,
            amount               NUMERIC(10,2) NOT NULL,
            method               VARCHAR(30) NOT NULL CHECK (method IN ('razorpay','cash','bank_transfer','cheque')),
            reference_no         VARCHAR(100),
            razorpay_payment_id  VARCHAR(100),
            notes                TEXT,
            recorded_by          UUID,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_fee_payments_invoice ON %I.fee_payments(invoice_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
      END LOOP;
    END;
    $outer$
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.fee_payments', t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
