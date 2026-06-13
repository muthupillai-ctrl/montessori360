exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- staff_details (extended HR fields)
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.staff_details (
            staff_id          UUID PRIMARY KEY,
            employee_no       VARCHAR(20),
            department        VARCHAR(100),
            designation       VARCHAR(100),
            salary            NUMERIC(10,2),
            pay_frequency     VARCHAR(10) NOT NULL DEFAULT 'monthly'
                                CHECK (pay_frequency IN ('monthly','weekly')),
            bank_account      VARCHAR(20),
            bank_ifsc         VARCHAR(11),
            pan_no            VARCHAR(10),
            aadhar_no         VARCHAR(12),
            address           TEXT,
            emergency_contact JSONB,
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- leave_balances
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.leave_balances (
            id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            staff_id      UUID NOT NULL,
            academic_year VARCHAR(9) NOT NULL,
            casual        INTEGER NOT NULL DEFAULT 12,
            sick          INTEGER NOT NULL DEFAULT 12,
            earned        INTEGER NOT NULL DEFAULT 15,
            casual_used   INTEGER NOT NULL DEFAULT 0,
            sick_used     INTEGER NOT NULL DEFAULT 0,
            earned_used   INTEGER NOT NULL DEFAULT 0,
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(staff_id, academic_year)
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_leave_bal_staff ON %I.leave_balances(staff_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- leave_requests
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.leave_requests (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            staff_id     UUID NOT NULL,
            leave_type   VARCHAR(20) NOT NULL CHECK (leave_type IN (
                           'casual','sick','earned','maternity','paternity','lwp','other')),
            from_date    DATE NOT NULL,
            to_date      DATE NOT NULL,
            days         INTEGER NOT NULL,
            reason       TEXT NOT NULL,
            status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected','cancelled')),
            reviewed_by  UUID,
            reviewed_at  TIMESTAMPTZ,
            review_note  TEXT,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_leave_req_staff ON %I.leave_requests(staff_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_leave_req_status ON %I.leave_requests(status)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- shifts
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.shifts (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            staff_id    UUID NOT NULL,
            date        DATE NOT NULL,
            shift_type  VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning','afternoon','full_day','split')),
            start_time  VARCHAR(5) NOT NULL,
            end_time    VARCHAR(5) NOT NULL,
            notes       TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_shifts_staff ON %I.shifts(staff_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_shifts_date ON %I.shifts(date)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- Init leave balances for all existing staff
        EXECUTE format($$
          INSERT INTO %I.leave_balances (staff_id, academic_year)
          SELECT id, '2025-2026' FROM %I.staff WHERE is_active = true
          ON CONFLICT (staff_id, academic_year) DO NOTHING
        $$, t.schema_name, t.schema_name);

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
        EXECUTE format('DROP TABLE IF EXISTS %I.shifts', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.leave_requests', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.leave_balances', t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.staff_details', t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
