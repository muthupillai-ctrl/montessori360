exports.up = async (pgm) => {
  pgm.sql(`
    DO $outer$
    DECLARE
      t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- vehicles
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.vehicles (
            id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            registration_no  VARCHAR(20) NOT NULL UNIQUE,
            vehicle_type     VARCHAR(10) NOT NULL CHECK (vehicle_type IN ('bus','van','auto','car','other')),
            make             VARCHAR(50),
            model            VARCHAR(50),
            capacity         INTEGER NOT NULL DEFAULT 20,
            fitness_expiry   DATE,
            insurance_expiry DATE,
            is_active        BOOLEAN NOT NULL DEFAULT true,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- transport_routes
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.transport_routes (
            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name            VARCHAR(100) NOT NULL,
            description     TEXT,
            vehicle_id      UUID,
            driver_id       UUID,
            waypoints       JSONB NOT NULL DEFAULT '[]',
            morning_start   VARCHAR(5),
            afternoon_start VARCHAR(5),
            is_active       BOOLEAN NOT NULL DEFAULT true,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);

        -- route_students
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.route_students (
            id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            route_id   UUID NOT NULL,
            student_id UUID NOT NULL UNIQUE,
            stop_no    INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_route_students_route ON %I.route_students(route_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- trips
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.trips (
            id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            route_id     UUID NOT NULL,
            trip_date    DATE NOT NULL,
            direction    VARCHAR(10) NOT NULL CHECK (direction IN ('pickup','dropoff')),
            status       VARCHAR(15) NOT NULL DEFAULT 'scheduled'
                           CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
            started_at   TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            driver_id    UUID,
            vehicle_id   UUID,
            notes        TEXT,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_trips_route ON %I.trips(route_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_trips_date ON %I.trips(trip_date DESC)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- trip_locations (GPS history)
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.trip_locations (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            trip_id     UUID NOT NULL,
            route_id    UUID NOT NULL,
            lat         DOUBLE PRECISION NOT NULL,
            lng         DOUBLE PRECISION NOT NULL,
            speed       NUMERIC(5,1),
            heading     NUMERIC(5,1),
            recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_trip_loc_trip ON %I.trip_locations(trip_id)',
          replace(t.schema_name, '-', '_'), t.schema_name
        );

        -- trip_boardings
        EXECUTE format($$
          CREATE TABLE IF NOT EXISTS %I.trip_boardings (
            id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            trip_id    UUID NOT NULL,
            student_id UUID NOT NULL,
            boarded    BOOLEAN NOT NULL DEFAULT false,
            boarded_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(trip_id, student_id)
          )
        $$, t.schema_name);
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS idx_%s_boardings_trip ON %I.trip_boardings(trip_id)',
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
        EXECUTE format('DROP TABLE IF EXISTS %I.trip_boardings',  t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.trip_locations',  t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.trips',           t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.route_students',  t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.transport_routes',t.schema_name);
        EXECUTE format('DROP TABLE IF EXISTS %I.vehicles',        t.schema_name);
      END LOOP;
    END;
    $outer$
  `);
};
