exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Add GPS device ID and year to vehicles
        EXECUTE format($$
          ALTER TABLE %I.vehicles
            ADD COLUMN IF NOT EXISTS year            SMALLINT,
            ADD COLUMN IF NOT EXISTS color           VARCHAR(30),
            ADD COLUMN IF NOT EXISTS gps_device_id  VARCHAR(100),
            ADD COLUMN IF NOT EXISTS notes           TEXT;
        $$, t.schema_name);

        -- Add active_days and gps_tracker_id to transport_routes
        EXECUTE format($$
          ALTER TABLE %I.transport_routes
            ADD COLUMN IF NOT EXISTS route_code   VARCHAR(20),
            ADD COLUMN IF NOT EXISTS active_days  VARCHAR(7) DEFAULT 'MTWTFSS',
            ADD COLUMN IF NOT EXISTS notes        TEXT;
        $$, t.schema_name);

        -- Create route_stops table (proper ordered stops)
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.route_stops (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            route_id     UUID NOT NULL,
            stop_order   INTEGER NOT NULL,
            name         VARCHAR(150) NOT NULL,
            address      TEXT,
            lat          DOUBLE PRECISION,
            lng          DOUBLE PRECISION,
            morning_eta  VARCHAR(5),
            evening_eta  VARCHAR(5),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(route_id, stop_order)
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_route_stops_route ON %I.route_stops(route_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- Enhance route_students with pickup/drop stop and fee
        EXECUTE format($$
          ALTER TABLE %I.route_students
            ADD COLUMN IF NOT EXISTS pickup_stop_id UUID,
            ADD COLUMN IF NOT EXISTS drop_stop_id   UUID,
            ADD COLUMN IF NOT EXISTS transport_fee  NUMERIC(10,2),
            ADD COLUMN IF NOT EXISTS rfid_card_no   VARCHAR(50),
            ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS notes          TEXT,
            ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();
        $$, t.schema_name);

        -- Add trip_type and status to trips
        EXECUTE format($$
          ALTER TABLE %I.trips
            ADD COLUMN IF NOT EXISTS trip_type    VARCHAR(10) DEFAULT 'morning' CHECK (trip_type IN ('morning','evening','special')),
            ADD COLUMN IF NOT EXISTS status       VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
            ADD COLUMN IF NOT EXISTS start_time   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS end_time     TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS delay_reason TEXT,
            ADD COLUMN IF NOT EXISTS notes        TEXT;
        $$, t.schema_name);

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
        EXECUTE format('DROP TABLE IF EXISTS %I.route_stops CASCADE', t.schema_name);
      END LOOP;
    END $outer$;
  `);
};
