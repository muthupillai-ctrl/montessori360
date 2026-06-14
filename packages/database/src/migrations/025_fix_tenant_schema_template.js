/**
 * Migration 025: Rebuild create_tenant_schema() to include all tables added
 * in migrations 004-024, and repair any existing tenant schemas that are missing
 * tables (e.g. schemas created before this fix).
 */

exports.up = async (pgm) => {

  // ── 1. Updated create_tenant_schema() with every current table ─────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.create_tenant_schema(p_schema text)
    RETURNS void LANGUAGE plpgsql AS $fn$
    BEGIN

      EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema);

      -- staff (includes admission_staff role from mig-013)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.staff (
          id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email          VARCHAR(255) NOT NULL UNIQUE,
          password_hash  TEXT NOT NULL,
          role           VARCHAR(50) NOT NULL CHECK (role IN (
                           'owner','principal','teacher',
                           'assistant_teacher','accountant','driver','support','admission_staff')),
          first_name     VARCHAR(100) NOT NULL,
          last_name      VARCHAR(100) NOT NULL,
          phone          VARCHAR(20),
          dob            DATE,
          joining_date   DATE,
          qualifications JSONB DEFAULT '[]',
          profile_photo  TEXT,
          is_active      BOOLEAN NOT NULL DEFAULT true,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- classes (section from mig-020, report_template_id from mig-008)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.classes (
          id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name               VARCHAR(100) NOT NULL,
          section            VARCHAR(20),
          age_group_min      INTEGER,
          age_group_max      INTEGER,
          teacher_id         UUID,
          capacity           INTEGER NOT NULL DEFAULT 25,
          room_number        VARCHAR(20),
          report_template_id UUID,
          is_active          BOOLEAN NOT NULL DEFAULT true,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_classes_name_section ON %I.classes(name, COALESCE(section, $$$$))',
        replace(p_schema, '-', '_'), p_schema
      );

      -- students
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.students (
          id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          admission_no       VARCHAR(50) NOT NULL UNIQUE,
          first_name         VARCHAR(100) NOT NULL,
          last_name          VARCHAR(100) NOT NULL,
          dob                DATE NOT NULL,
          gender             VARCHAR(10) CHECK (gender IN ('male','female','other')),
          class_id           UUID,
          profile_photo      TEXT,
          blood_group        VARCHAR(10),
          nationality        VARCHAR(50) DEFAULT 'Indian',
          aadhar_no          VARCHAR(12),
          emergency_contacts JSONB NOT NULL DEFAULT '[]',
          medical_notes      JSONB NOT NULL DEFAULT '{}',
          dietary_notes      TEXT,
          allergies          TEXT[],
          previous_school    VARCHAR(255),
          admission_date     DATE NOT NULL DEFAULT CURRENT_DATE,
          sibling_ids        UUID[] DEFAULT '{}',
          transport_route_id UUID,
          is_active          BOOLEAN NOT NULL DEFAULT true,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_students_class  ON %I.students(class_id)',     replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_students_admno  ON %I.students(admission_no)', replace(p_schema,'-','_'), p_schema);

      -- parent_accounts
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.parent_accounts (
          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email         VARCHAR(255) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          first_name    VARCHAR(100) NOT NULL,
          last_name     VARCHAR(100) NOT NULL,
          phone         VARCHAR(20) NOT NULL,
          relation      VARCHAR(30) CHECK (relation IN ('father','mother','guardian','other')),
          student_ids   UUID[] NOT NULL DEFAULT '{}',
          fcm_token     TEXT,
          is_active     BOOLEAN NOT NULL DEFAULT true,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- attendance
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.attendance (
          id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id      UUID NOT NULL,
          date            DATE NOT NULL,
          check_in_time   TIMESTAMPTZ,
          check_out_time  TIMESTAMPTZ,
          status          VARCHAR(20) NOT NULL DEFAULT 'present'
                            CHECK (status IN ('present','absent','late','half_day','holiday')),
          mode            VARCHAR(20) DEFAULT 'manual'
                            CHECK (mode IN ('qr','biometric','manual')),
          marked_by       UUID,
          parent_notified BOOLEAN NOT NULL DEFAULT false,
          notified_at     TIMESTAMPTZ,
          notes           TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(student_id, date)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_attendance_date    ON %I.attendance(date)',       replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_attendance_student ON %I.attendance(student_id)', replace(p_schema,'-','_'), p_schema);

      -- fee_structures
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.fee_structures (
          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name          VARCHAR(255) NOT NULL,
          academic_year VARCHAR(9) NOT NULL,
          billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly','quarterly','half_yearly','annually','one_time')),
          heads         JSONB NOT NULL DEFAULT '[]',
          applies_to    VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','class')),
          class_ids     UUID[] DEFAULT '{}',
          is_active     BOOLEAN NOT NULL DEFAULT true,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- fee_invoices (invoice_type from mig-017)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.fee_invoices (
          id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          invoice_no        VARCHAR(50) NOT NULL UNIQUE,
          student_id        UUID NOT NULL,
          fee_structure_id  UUID,
          billing_period    VARCHAR(30) NOT NULL,
          line_items        JSONB NOT NULL DEFAULT '[]',
          subtotal          NUMERIC(10,2) NOT NULL,
          discount          NUMERIC(10,2) NOT NULL DEFAULT 0,
          tax               NUMERIC(10,2) NOT NULL DEFAULT 0,
          total             NUMERIC(10,2) NOT NULL,
          due_date          DATE NOT NULL,
          status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','partial','overdue','waived')),
          invoice_type      VARCHAR(20) NOT NULL DEFAULT 'adhoc'
                              CHECK (invoice_type IN ('fee_structure','transport','adhoc')),
          razorpay_order_id TEXT,
          paid_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
          paid_at           TIMESTAMPTZ,
          payment_method    VARCHAR(30) CHECK (payment_method IN ('razorpay','cash','bank_transfer','cheque')),
          created_by        UUID,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_invoices_student ON %I.fee_invoices(student_id)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_invoices_status  ON %I.fee_invoices(status)',     replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_invoices_due     ON %I.fee_invoices(due_date)',   replace(p_schema,'-','_'), p_schema);
      EXECUTE format($$
        CREATE UNIQUE INDEX IF NOT EXISTS uq_%s_invoice_structure
          ON %I.fee_invoices(student_id, billing_period, fee_structure_id)
          WHERE invoice_type = 'fee_structure' AND fee_structure_id IS NOT NULL
      $$, replace(p_schema,'-','_'), p_schema);
      EXECUTE format($$
        CREATE UNIQUE INDEX IF NOT EXISTS uq_%s_invoice_transport
          ON %I.fee_invoices(student_id, billing_period)
          WHERE invoice_type = 'transport'
      $$, replace(p_schema,'-','_'), p_schema);

      -- fee_payments (mig-004)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.fee_payments (
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
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_fee_payments_invoice ON %I.fee_payments(invoice_id)', replace(p_schema,'-','_'), p_schema);

      -- announcements
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.announcements (
          id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title        VARCHAR(255) NOT NULL,
          body         TEXT NOT NULL,
          audience     VARCHAR(20) NOT NULL DEFAULT 'all'
                         CHECK (audience IN ('all','staff','parents','class')),
          class_ids    UUID[] DEFAULT '{}',
          attachments  JSONB DEFAULT '[]',
          published_at TIMESTAMPTZ,
          expires_at   TIMESTAMPTZ,
          created_by   UUID,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- messages
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.messages (
          id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          sender_id      UUID NOT NULL,
          sender_type    VARCHAR(10) NOT NULL CHECK (sender_type IN ('staff','parent')),
          recipient_id   UUID NOT NULL,
          recipient_type VARCHAR(10) NOT NULL CHECK (recipient_type IN ('staff','parent')),
          body           TEXT NOT NULL,
          attachments    JSONB DEFAULT '[]',
          is_read        BOOLEAN NOT NULL DEFAULT false,
          read_at        TIMESTAMPTZ,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_messages_sender    ON %I.messages(sender_id, sender_type)',       replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_messages_recipient ON %I.messages(recipient_id, recipient_type)', replace(p_schema,'-','_'), p_schema);

      -- audit_logs
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.audit_logs (
          id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          actor_id   UUID,
          actor_type VARCHAR(20),
          action     VARCHAR(100) NOT NULL,
          entity     VARCHAR(100) NOT NULL,
          entity_id  UUID,
          delta      JSONB,
          ip_address INET,
          user_agent TEXT,
          ts         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_audit_ts     ON %I.audit_logs(ts DESC)',         replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_audit_entity ON %I.audit_logs(entity, entity_id)', replace(p_schema,'-','_'), p_schema);

      -- circulars (mig-005)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.circulars (
          id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title        VARCHAR(255) NOT NULL,
          body         TEXT NOT NULL,
          audience     VARCHAR(20) NOT NULL DEFAULT 'all'
                         CHECK (audience IN ('all','staff','parents','class')),
          class_ids    UUID[] DEFAULT '{}',
          attachments  JSONB DEFAULT '[]',
          requires_ack BOOLEAN NOT NULL DEFAULT true,
          published_at TIMESTAMPTZ,
          expires_at   TIMESTAMPTZ,
          created_by   UUID,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_circulars_published ON %I.circulars(published_at DESC)', replace(p_schema,'-','_'), p_schema);

      -- circular_acknowledgements (mig-005)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.circular_acknowledgements (
          id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          circular_id       UUID NOT NULL,
          acknowledged_by   UUID NOT NULL,
          acknowledger_type VARCHAR(10) NOT NULL CHECK (acknowledger_type IN ('staff','parent')),
          acknowledged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(circular_id, acknowledged_by)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_circ_acks_circular ON %I.circular_acknowledgements(circular_id)', replace(p_schema,'-','_'), p_schema);

      -- daily_journals (mig-006)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.daily_journals (
          id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id   UUID NOT NULL,
          journal_date DATE NOT NULL,
          meal         JSONB NOT NULL DEFAULT '{}',
          nap          JSONB NOT NULL DEFAULT '{}',
          toilet       JSONB NOT NULL DEFAULT '{"count":0}',
          activities   JSONB NOT NULL DEFAULT '[]',
          mood         VARCHAR(20) CHECK (mood IN ('happy','calm','unsettled','upset')),
          mood_note    TEXT,
          homework     JSONB NOT NULL DEFAULT '[]',
          teacher_note TEXT,
          published_at TIMESTAMPTZ,
          created_by   UUID,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(student_id, journal_date)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_journals_student ON %I.daily_journals(student_id)',           replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_journals_date    ON %I.daily_journals(journal_date DESC)',    replace(p_schema,'-','_'), p_schema);

      -- obs_domains (mig-007)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.obs_domains (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name        VARCHAR(100) NOT NULL,
          code        VARCHAR(50) NOT NULL UNIQUE,
          is_standard BOOLEAN NOT NULL DEFAULT false,
          description TEXT,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          is_active   BOOLEAN NOT NULL DEFAULT true,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- obs_milestones (mig-007)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.obs_milestones (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          domain_id   UUID NOT NULL,
          code        VARCHAR(20) NOT NULL,
          name        VARCHAR(255) NOT NULL,
          description TEXT,
          age_min     INTEGER,
          age_max     INTEGER,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          is_active   BOOLEAN NOT NULL DEFAULT true,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(domain_id, code)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_milestones_domain ON %I.obs_milestones(domain_id)', replace(p_schema,'-','_'), p_schema);

      -- observations (mig-007)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.observations (
          id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id   UUID NOT NULL,
          milestone_id UUID NOT NULL,
          domain_id    UUID NOT NULL,
          grade        VARCHAR(20) NOT NULL CHECK (grade IN ('not_started','in_progress','led','mastered')),
          notes        TEXT,
          observed_by  UUID,
          observed_on  DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(student_id, milestone_id)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_obs_student ON %I.observations(student_id)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_obs_domain  ON %I.observations(domain_id)',  replace(p_schema,'-','_'), p_schema);

      -- report_templates (mig-008)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.report_templates (
          id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name             VARCHAR(100) NOT NULL,
          description      TEXT,
          logo_url         TEXT,
          primary_colour   VARCHAR(7) NOT NULL DEFAULT '#1F3864',
          secondary_colour VARCHAR(7) NOT NULL DEFAULT '#2E5AA8',
          accent_colour    VARCHAR(7) NOT NULL DEFAULT '#D6E4F0',
          font             VARCHAR(20) NOT NULL DEFAULT 'helvetica'
                             CHECK (font IN ('helvetica','times','courier')),
          sections         JSONB NOT NULL DEFAULT '[]',
          is_default       BOOLEAN NOT NULL DEFAULT false,
          is_active        BOOLEAN NOT NULL DEFAULT true,
          created_by       UUID,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- academic_years (mig-009)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.academic_years (
          id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name         VARCHAR(20) NOT NULL UNIQUE,
          start_date   DATE NOT NULL,
          end_date     DATE NOT NULL,
          is_current   BOOLEAN NOT NULL DEFAULT false,
          working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- terms (mig-009)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.terms (
          id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          academic_year_id UUID NOT NULL,
          name             VARCHAR(50) NOT NULL,
          start_date       DATE NOT NULL,
          end_date         DATE NOT NULL,
          sort_order       INTEGER NOT NULL DEFAULT 1,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_terms_year ON %I.terms(academic_year_id)', replace(p_schema,'-','_'), p_schema);

      -- calendar_events (mig-009)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.calendar_events (
          id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title              VARCHAR(255) NOT NULL,
          description        TEXT,
          event_type         VARCHAR(20) NOT NULL CHECK (event_type IN (
                               'holiday','exam','event','meeting',
                               'excursion','closure','term_start','term_end','other')),
          start_date         DATE NOT NULL,
          end_date           DATE NOT NULL,
          is_all_day         BOOLEAN NOT NULL DEFAULT true,
          start_time         VARCHAR(5),
          end_time           VARCHAR(5),
          affects_attendance BOOLEAN NOT NULL DEFAULT false,
          class_ids          UUID[] DEFAULT '{}',
          recurrence         VARCHAR(10) NOT NULL DEFAULT 'none'
                               CHECK (recurrence IN ('none','weekly','monthly','yearly')),
          colour             VARCHAR(7) NOT NULL DEFAULT '#2E5AA8',
          created_by         UUID,
          created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_events_dates ON %I.calendar_events(start_date, end_date)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_events_type  ON %I.calendar_events(event_type)',           replace(p_schema,'-','_'), p_schema);

      -- staff_details (mig-010)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.staff_details (
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
      $$, p_schema);

      -- leave_balances (mig-010)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.leave_balances (
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
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_leave_bal_staff ON %I.leave_balances(staff_id)', replace(p_schema,'-','_'), p_schema);

      -- leave_requests (mig-010)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.leave_requests (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          staff_id    UUID NOT NULL,
          leave_type  VARCHAR(20) NOT NULL CHECK (leave_type IN (
                        'casual','sick','earned','maternity','paternity','lwp','other')),
          from_date   DATE NOT NULL,
          to_date     DATE NOT NULL,
          days        INTEGER NOT NULL,
          reason      TEXT NOT NULL,
          status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','cancelled')),
          reviewed_by UUID,
          reviewed_at TIMESTAMPTZ,
          review_note TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_leave_req_staff  ON %I.leave_requests(staff_id)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_leave_req_status ON %I.leave_requests(status)',   replace(p_schema,'-','_'), p_schema);

      -- shifts (mig-010)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.shifts (
          id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          staff_id   UUID NOT NULL,
          date       DATE NOT NULL,
          shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning','afternoon','full_day','split')),
          start_time VARCHAR(5) NOT NULL,
          end_time   VARCHAR(5) NOT NULL,
          notes      TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_shifts_staff ON %I.shifts(staff_id)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_shifts_date  ON %I.shifts(date)',     replace(p_schema,'-','_'), p_schema);

      -- vehicles (mig-011 + mig-014 columns)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.vehicles (
          id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          registration_no  VARCHAR(20) NOT NULL UNIQUE,
          vehicle_type     VARCHAR(10) NOT NULL CHECK (vehicle_type IN ('bus','van','auto','car','other')),
          make             VARCHAR(50),
          model            VARCHAR(50),
          year             SMALLINT,
          color            VARCHAR(30),
          capacity         INTEGER NOT NULL DEFAULT 20,
          gps_device_id    VARCHAR(100),
          fitness_expiry   DATE,
          insurance_expiry DATE,
          notes            TEXT,
          is_active        BOOLEAN NOT NULL DEFAULT true,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- transport_routes (mig-011 + mig-014 + mig-016 columns)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.transport_routes (
          id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name            VARCHAR(100) NOT NULL,
          description     TEXT,
          vehicle_id      UUID,
          driver_id       UUID,
          waypoints       JSONB NOT NULL DEFAULT '[]',
          morning_start   VARCHAR(5),
          afternoon_start VARCHAR(5),
          route_code      VARCHAR(20),
          active_days     VARCHAR(7) DEFAULT 'MTWTFSS',
          monthly_fee     NUMERIC(10,2),
          notes           TEXT,
          is_active       BOOLEAN NOT NULL DEFAULT true,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- route_stops (mig-014)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.route_stops (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          route_id    UUID NOT NULL,
          stop_order  INTEGER NOT NULL,
          name        VARCHAR(150) NOT NULL,
          address     TEXT,
          lat         DOUBLE PRECISION,
          lng         DOUBLE PRECISION,
          morning_eta VARCHAR(5),
          evening_eta VARCHAR(5),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(route_id, stop_order)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_route_stops_route ON %I.route_stops(route_id)', replace(p_schema,'-','_'), p_schema);

      -- route_students (mig-011 + mig-014, transport_fee dropped by mig-016)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.route_students (
          id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          route_id       UUID NOT NULL,
          student_id     UUID NOT NULL UNIQUE,
          stop_no        INTEGER NOT NULL,
          pickup_stop_id UUID,
          drop_stop_id   UUID,
          rfid_card_no   VARCHAR(50),
          is_active      BOOLEAN NOT NULL DEFAULT true,
          notes          TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_route_students_route ON %I.route_students(route_id)', replace(p_schema,'-','_'), p_schema);

      -- trips (mig-011 + mig-014 columns)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.trips (
          id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          route_id     UUID NOT NULL,
          trip_date    DATE NOT NULL,
          direction    VARCHAR(10) NOT NULL CHECK (direction IN ('pickup','dropoff')),
          status       VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
          started_at   TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          driver_id    UUID,
          vehicle_id   UUID,
          trip_type    VARCHAR(10) DEFAULT 'morning' CHECK (trip_type IN ('morning','evening','special')),
          start_time   TIMESTAMPTZ,
          end_time     TIMESTAMPTZ,
          delay_reason TEXT,
          notes        TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_trips_route ON %I.trips(route_id)',         replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_trips_date  ON %I.trips(trip_date DESC)',   replace(p_schema,'-','_'), p_schema);

      -- trip_locations (mig-011)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.trip_locations (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          trip_id     UUID NOT NULL,
          route_id    UUID NOT NULL,
          lat         DOUBLE PRECISION NOT NULL,
          lng         DOUBLE PRECISION NOT NULL,
          speed       NUMERIC(5,1),
          heading     NUMERIC(5,1),
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_trip_loc_trip ON %I.trip_locations(trip_id)', replace(p_schema,'-','_'), p_schema);

      -- trip_boardings (mig-011 + mig-018 columns)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.trip_boardings (
          id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          trip_id    UUID NOT NULL,
          student_id UUID NOT NULL,
          boarded    BOOLEAN NOT NULL DEFAULT false,
          boarded_at TIMESTAMPTZ,
          dropped    BOOLEAN NOT NULL DEFAULT false,
          dropped_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(trip_id, student_id)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_boardings_trip ON %I.trip_boardings(trip_id)', replace(p_schema,'-','_'), p_schema);

      -- student_parents (mig-012)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.student_parents (
          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id    UUID NOT NULL REFERENCES %1$I.students(id) ON DELETE CASCADE,
          relation      VARCHAR(20) NOT NULL CHECK (relation IN ('father','mother','guardian','step_father','step_mother','other')),
          first_name    VARCHAR(100) NOT NULL,
          last_name     VARCHAR(100) NOT NULL,
          email         VARCHAR(255),
          mobile        VARCHAR(20),
          mobile_alt    VARCHAR(20),
          profession    VARCHAR(100),
          employer      VARCHAR(150),
          annual_income NUMERIC(12,2),
          education     VARCHAR(100),
          is_primary    BOOLEAN NOT NULL DEFAULT false,
          can_pickup    BOOLEAN NOT NULL DEFAULT true,
          notes         TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sp_student ON %I.student_parents(student_id)',                replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_sp_email   ON %I.student_parents(email) WHERE email IS NOT NULL', replace(p_schema,'-','_'), p_schema);

      -- subjects (mig-019)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.subjects (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name        VARCHAR(100) NOT NULL,
          code        VARCHAR(20),
          color       VARCHAR(7) NOT NULL DEFAULT '#2563EB',
          description TEXT,
          is_active   BOOLEAN NOT NULL DEFAULT true,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- period_templates (mig-019)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.period_templates (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name        VARCHAR(100) NOT NULL,
          description TEXT,
          is_default  BOOLEAN NOT NULL DEFAULT false,
          is_active   BOOLEAN NOT NULL DEFAULT true,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- template_slots (mig-019)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.template_slots (
          id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          template_id UUID NOT NULL REFERENCES %1$I.period_templates(id) ON DELETE CASCADE,
          name        VARCHAR(100) NOT NULL,
          slot_type   VARCHAR(20) NOT NULL DEFAULT 'period'
                        CHECK (slot_type IN ('period','work_cycle','break','assembly','other')),
          start_time  TIME NOT NULL,
          end_time    TIME NOT NULL,
          sort_order  INT NOT NULL DEFAULT 0,
          color       VARCHAR(7),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tpl_slots_tpl ON %I.template_slots(template_id)', replace(p_schema,'-','_'), p_schema);

      -- timetables (mig-019)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.timetables (
          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          class_id      UUID NOT NULL REFERENCES %1$I.classes(id) ON DELETE CASCADE,
          academic_year VARCHAR(20) NOT NULL,
          name          VARCHAR(100),
          mon_template  UUID REFERENCES %1$I.period_templates(id),
          tue_template  UUID REFERENCES %1$I.period_templates(id),
          wed_template  UUID REFERENCES %1$I.period_templates(id),
          thu_template  UUID REFERENCES %1$I.period_templates(id),
          fri_template  UUID REFERENCES %1$I.period_templates(id),
          sat_template  UUID REFERENCES %1$I.period_templates(id),
          is_active     BOOLEAN NOT NULL DEFAULT true,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_tt_class_year ON %I.timetables(class_id, academic_year)', replace(p_schema,'-','_'), p_schema);

      -- timetable_slots (mig-019)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.timetable_slots (
          id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          timetable_id         UUID NOT NULL REFERENCES %1$I.timetables(id) ON DELETE CASCADE,
          template_slot_id     UUID NOT NULL REFERENCES %1$I.template_slots(id) ON DELETE CASCADE,
          day_of_week          SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
          subject_id           UUID REFERENCES %1$I.subjects(id),
          teacher_id           UUID REFERENCES %1$I.staff(id),
          slot_type            VARCHAR(20) NOT NULL DEFAULT 'period'
                                 CHECK (slot_type IN ('period','work_cycle','break','assembly','free','other')),
          notes                TEXT,
          conflict_approved    BOOLEAN NOT NULL DEFAULT false,
          conflict_approved_by UUID REFERENCES %1$I.staff(id),
          created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_tt_slots_uniq    ON %I.timetable_slots(timetable_id, template_slot_id, day_of_week)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX        IF NOT EXISTS idx_%s_tt_slots_teacher ON %I.timetable_slots(teacher_id)', replace(p_schema,'-','_'), p_schema);

      -- class_subject_teachers (mig-023)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.class_subject_teachers (
          id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          class_id   UUID NOT NULL REFERENCES %1$I.classes(id) ON DELETE CASCADE,
          subject_id UUID NOT NULL REFERENCES %1$I.subjects(id) ON DELETE CASCADE,
          teacher_id UUID REFERENCES %1$I.staff(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_cst_class_subject ON %I.class_subject_teachers(class_id, subject_id)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX        IF NOT EXISTS idx_%s_cst_teacher        ON %I.class_subject_teachers(teacher_id)',           replace(p_schema,'-','_'), p_schema);

      -- student_enrollments (mig-024)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.student_enrollments (
          id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id             UUID NOT NULL REFERENCES %1$I.students(id) ON DELETE CASCADE,
          academic_year_id       UUID NOT NULL REFERENCES %1$I.academic_years(id) ON DELETE CASCADE,
          class_id               UUID NOT NULL REFERENCES %1$I.classes(id) ON DELETE CASCADE,
          promoted_from_class_id UUID REFERENCES %1$I.classes(id) ON DELETE SET NULL,
          promoted_at            TIMESTAMPTZ,
          created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(student_id, academic_year_id)
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_enrollments_student ON %I.student_enrollments(student_id)',       replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_enrollments_year    ON %I.student_enrollments(academic_year_id)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_enrollments_class   ON %I.student_enrollments(class_id)',         replace(p_schema,'-','_'), p_schema);

      -- promotion_batches (mig-024)
      EXECUTE format($$
        CREATE TABLE IF NOT EXISTS %1$I.promotion_batches (
          id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          from_academic_year_id UUID NOT NULL REFERENCES %1$I.academic_years(id),
          to_academic_year_id   UUID NOT NULL REFERENCES %1$I.academic_years(id),
          class_mapping         JSONB NOT NULL DEFAULT '[]',
          status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','in_progress','completed','failed')),
          total_students        INT NOT NULL DEFAULT 0,
          promoted_count        INT NOT NULL DEFAULT 0,
          graduated_count       INT NOT NULL DEFAULT 0,
          skipped_count         INT NOT NULL DEFAULT 0,
          errors                JSONB NOT NULL DEFAULT '[]',
          created_by            UUID REFERENCES %1$I.staff(id) ON DELETE SET NULL,
          started_at            TIMESTAMPTZ,
          completed_at          TIMESTAMPTZ,
          created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_promo_from ON %I.promotion_batches(from_academic_year_id)', replace(p_schema,'-','_'), p_schema);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_promo_to   ON %I.promotion_batches(to_academic_year_id)',   replace(p_schema,'-','_'), p_schema);

    END;
    $fn$;
  `);

  // ── 2. seed_tenant_defaults(): obs domains/milestones, report template, academic year ──
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.seed_tenant_defaults(p_schema text)
    RETURNS void LANGUAGE plpgsql AS $fn$
    DECLARE
      d_pl_id   UUID;
      d_lang_id UUID;
      d_cult_id UUID;
      d_math_id UUID;
      d_se_id   UUID;
    BEGIN

      -- Default report template
      EXECUTE format($$
        INSERT INTO %1$I.report_templates (name, description, is_default, sections)
        VALUES (
          'Default Template', 'Standard Montessori360 progress card', true,
          '[
            {"key":"cover",           "enabled":true,  "order":1},
            {"key":"attendance",      "enabled":true,  "order":2},
            {"key":"mood",            "enabled":true,  "order":3},
            {"key":"domain_progress", "enabled":true,  "order":4},
            {"key":"teacher_note",    "enabled":true,  "order":5},
            {"key":"homework_summary","enabled":false, "order":6},
            {"key":"photo_collage",   "enabled":false, "order":7}
          ]'::jsonb
        ) ON CONFLICT DO NOTHING
      $$, p_schema);

      -- Academic year 2026-2027 (current)
      EXECUTE format($$
        INSERT INTO %1$I.academic_years (name, start_date, end_date, is_current)
        VALUES ('2026-2027', '2026-06-01', '2027-03-31', true)
        ON CONFLICT (name) DO NOTHING
      $$, p_schema);

      EXECUTE format($$
        INSERT INTO %1$I.terms (academic_year_id, name, start_date, end_date, sort_order)
        SELECT id, 'Term 1', '2026-06-01', '2026-09-30', 1 FROM %1$I.academic_years WHERE name = '2026-2027'
        ON CONFLICT DO NOTHING
      $$, p_schema);
      EXECUTE format($$
        INSERT INTO %1$I.terms (academic_year_id, name, start_date, end_date, sort_order)
        SELECT id, 'Term 2', '2026-10-01', '2026-12-31', 2 FROM %1$I.academic_years WHERE name = '2026-2027'
        ON CONFLICT DO NOTHING
      $$, p_schema);
      EXECUTE format($$
        INSERT INTO %1$I.terms (academic_year_id, name, start_date, end_date, sort_order)
        SELECT id, 'Term 3', '2027-01-01', '2027-03-31', 3 FROM %1$I.academic_years WHERE name = '2026-2027'
        ON CONFLICT DO NOTHING
      $$, p_schema);

      -- Obs domains
      EXECUTE format($$
        INSERT INTO %1$I.obs_domains (name, code, is_standard, description, sort_order) VALUES
          ('Practical Life',      'practical_life',   true, 'Self-care, classroom care, grace and courtesy', 1),
          ('Language',            'language',         true, 'Spoken, pre-reading, reading, writing', 2),
          ('Cultural / Sensorial','cultural',         true, 'Geography, botany, zoology, music, art, sensorial', 3),
          ('Mathematics',         'mathematics',      true, 'Counting, numerals, decimal system, arithmetic, geometry', 4),
          ('Social & Emotional',  'social_emotional', true, 'Peer relations, self-regulation, independence', 5)
        ON CONFLICT (code) DO NOTHING
      $$, p_schema);

      EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', p_schema) INTO d_pl_id   USING 'practical_life';
      EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', p_schema) INTO d_lang_id USING 'language';
      EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', p_schema) INTO d_cult_id USING 'cultural';
      EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', p_schema) INTO d_math_id USING 'mathematics';
      EXECUTE format('SELECT id FROM %I.obs_domains WHERE code = $1', p_schema) INTO d_se_id   USING 'social_emotional';

      EXECUTE format($$
        INSERT INTO %1$I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
          ($1,'PL-001','Carries objects safely',18,36,1), ($1,'PL-002','Pours liquid without spilling',24,42,2),
          ($1,'PL-003','Washes hands independently',24,42,3), ($1,'PL-004','Dresses and undresses independently',30,54,4),
          ($1,'PL-005','Uses utensils correctly',24,48,5), ($1,'PL-006','Sweeps and cleans up after work',30,54,6),
          ($1,'PL-007','Greets others respectfully',24,60,7), ($1,'PL-008','Waits for turn patiently',30,60,8)
        ON CONFLICT (domain_id, code) DO NOTHING
      $$, p_schema) USING d_pl_id;

      EXECUTE format($$
        INSERT INTO %1$I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
          ($1,'LA-001','Speaks in complete sentences',24,42,1), ($1,'LA-002','Recognises letter sounds (phonics)',36,54,2),
          ($1,'LA-003','Identifies letters by name',36,60,3), ($1,'LA-004','Blends CVC words',42,66,4),
          ($1,'LA-005','Reads simple 3-letter words',48,72,5), ($1,'LA-006','Holds pencil with correct grip',36,60,6),
          ($1,'LA-007','Traces letters on sandpaper',36,54,7), ($1,'LA-008','Writes own name',48,72,8),
          ($1,'LA-009','Listens to and retells a story',30,54,9)
        ON CONFLICT (domain_id, code) DO NOTHING
      $$, p_schema) USING d_lang_id;

      EXECUTE format($$
        INSERT INTO %1$I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
          ($1,'CU-001','Names continents on globe',42,66,1), ($1,'CU-002','Matches continent puzzle pieces',42,72,2),
          ($1,'CU-003','Names and classifies living vs non-living',36,60,3), ($1,'CU-004','Identifies parts of a plant',42,66,4),
          ($1,'CU-005','Participates in music activities',24,72,5), ($1,'CU-006','Uses art materials purposefully',24,72,6),
          ($1,'CU-007','Matches sensorial materials by texture',24,42,7), ($1,'CU-008','Orders sensorial materials by size',30,54,8)
        ON CONFLICT (domain_id, code) DO NOTHING
      $$, p_schema) USING d_cult_id;

      EXECUTE format($$
        INSERT INTO %1$I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
          ($1,'MA-001','Counts objects 1-10 one-to-one',30,48,1), ($1,'MA-002','Recognises numerals 1-10',36,54,2),
          ($1,'MA-003','Counts with number rods',36,54,3), ($1,'MA-004','Understands quantity with golden beads',42,66,4),
          ($1,'MA-005','Recognises numerals 1-100',48,72,5), ($1,'MA-006','Performs simple addition',54,84,6),
          ($1,'MA-007','Performs simple subtraction',54,84,7), ($1,'MA-008','Identifies basic geometric shapes',36,60,8)
        ON CONFLICT (domain_id, code) DO NOTHING
      $$, p_schema) USING d_math_id;

      EXECUTE format($$
        INSERT INTO %1$I.obs_milestones (domain_id, code, name, age_min, age_max, sort_order) VALUES
          ($1,'SE-001','Works independently for 10+ minutes',30,54,1), ($1,'SE-002','Chooses work from shelf independently',30,54,2),
          ($1,'SE-003','Returns materials to correct place',24,48,3), ($1,'SE-004','Resolves peer conflicts calmly',42,72,4),
          ($1,'SE-005','Shows empathy towards others',36,66,5), ($1,'SE-006','Follows classroom ground rules',24,48,6),
          ($1,'SE-007','Completes a work cycle',36,60,7), ($1,'SE-008','Expresses emotions with words',30,60,8)
        ON CONFLICT (domain_id, code) DO NOTHING
      $$, p_schema) USING d_se_id;

      -- Seed default classes
      PERFORM public.seed_default_classes(p_schema);

    END;
    $fn$;
  `);

  // ── 3. Repair all existing tenant schemas ─────────────────────────────────
  pgm.sql(`
    DO $outer$
    DECLARE t RECORD;
    BEGIN
      FOR t IN SELECT schema_name FROM public.tenants LOOP

        -- Column additions MUST come before create_tenant_schema() so that
        -- the unique index on classes(name, COALESCE(section,'')) can be created.

        -- Column additions from mig-013: update staff role check
        EXECUTE format('ALTER TABLE %I.staff DROP CONSTRAINT IF EXISTS staff_role_check', t.schema_name);
        EXECUTE format($$
          ALTER TABLE %I.staff ADD CONSTRAINT staff_role_check CHECK (role IN (
            'owner','principal','teacher','assistant_teacher','accountant','driver','support','admission_staff'
          ))
        $$, t.schema_name);

        -- Column additions from mig-008, mig-020
        EXECUTE format('ALTER TABLE %I.classes ADD COLUMN IF NOT EXISTS report_template_id UUID', t.schema_name);
        EXECUTE format('ALTER TABLE %I.classes ADD COLUMN IF NOT EXISTS section VARCHAR(20)',     t.schema_name);

        -- mig-017: invoice_type needed before create_tenant_schema creates the partial index
        EXECUTE format($$
          ALTER TABLE %I.fee_invoices
            ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) NOT NULL DEFAULT 'adhoc'
              CHECK (invoice_type IN ('fee_structure','transport','adhoc'))
        $$, t.schema_name);

        -- Create all missing tables. All pre-existing tables use IF NOT EXISTS → no-op.
        -- Columns added above ensure dependent indexes can be built.
        PERFORM public.create_tenant_schema(t.schema_name);

        -- Post-create column additions: tables now guaranteed to exist (either pre-existing or
        -- just created by create_tenant_schema). ADD COLUMN IF NOT EXISTS is a no-op if already there.

        EXECUTE format($$
          ALTER TABLE %I.vehicles
            ADD COLUMN IF NOT EXISTS year          SMALLINT,
            ADD COLUMN IF NOT EXISTS color         VARCHAR(30),
            ADD COLUMN IF NOT EXISTS gps_device_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS notes         TEXT
        $$, t.schema_name);

        EXECUTE format($$
          ALTER TABLE %I.transport_routes
            ADD COLUMN IF NOT EXISTS route_code  VARCHAR(20),
            ADD COLUMN IF NOT EXISTS active_days VARCHAR(7) DEFAULT 'MTWTFSS',
            ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2),
            ADD COLUMN IF NOT EXISTS notes       TEXT
        $$, t.schema_name);

        EXECUTE format($$
          ALTER TABLE %I.route_students
            ADD COLUMN IF NOT EXISTS pickup_stop_id UUID,
            ADD COLUMN IF NOT EXISTS drop_stop_id   UUID,
            ADD COLUMN IF NOT EXISTS rfid_card_no   VARCHAR(50),
            ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS notes          TEXT,
            ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        $$, t.schema_name);

        EXECUTE format($$
          ALTER TABLE %I.trips
            ADD COLUMN IF NOT EXISTS trip_type    VARCHAR(10) DEFAULT 'morning',
            ADD COLUMN IF NOT EXISTS start_time   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS end_time     TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS delay_reason TEXT,
            ADD COLUMN IF NOT EXISTS notes        TEXT
        $$, t.schema_name);

        EXECUTE format($$
          ALTER TABLE %I.trip_boardings
            ADD COLUMN IF NOT EXISTS dropped    BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS dropped_at TIMESTAMPTZ
        $$, t.schema_name);

        -- Seed defaults (ON CONFLICT DO NOTHING so safe on existing tenants)
        PERFORM public.seed_tenant_defaults(t.schema_name);

        -- Backfill student_enrollments for current year (mig-024 pattern)
        EXECUTE format($$
          INSERT INTO %1$I.student_enrollments (student_id, academic_year_id, class_id)
          SELECT s.id, ay.id, s.class_id
          FROM   %1$I.students s
          CROSS JOIN (SELECT id FROM %1$I.academic_years WHERE is_current = true LIMIT 1) ay
          WHERE  s.is_active = true AND s.class_id IS NOT NULL
          ON CONFLICT (student_id, academic_year_id) DO NOTHING
        $$, t.schema_name);

      END LOOP;
    END;
    $outer$
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS public.seed_tenant_defaults(text)');
};
