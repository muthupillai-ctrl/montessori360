/**
 * Migration: 002_tenant_schema_template
 * Creates create_tenant_schema() stored procedure.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.create_tenant_schema(p_schema text)
    RETURNS void LANGUAGE plpgsql AS $fn$
    BEGIN

      EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema);

      -- staff
      EXECUTE format($$
        CREATE TABLE %I.staff (
          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email         VARCHAR(255) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role          VARCHAR(50) NOT NULL CHECK (role IN (
                          'owner','principal','teacher',
                          'assistant_teacher','accountant','driver','support')),
          first_name    VARCHAR(100) NOT NULL,
          last_name     VARCHAR(100) NOT NULL,
          phone         VARCHAR(20),
          dob           DATE,
          joining_date  DATE,
          qualifications JSONB DEFAULT '[]',
          profile_photo  TEXT,
          is_active     BOOLEAN NOT NULL DEFAULT true,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- classes
      EXECUTE format($$
        CREATE TABLE %I.classes (
          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name          VARCHAR(100) NOT NULL,
          age_group_min INTEGER,
          age_group_max INTEGER,
          teacher_id    UUID,
          capacity      INTEGER NOT NULL DEFAULT 25,
          room_number   VARCHAR(20),
          is_active     BOOLEAN NOT NULL DEFAULT true,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      -- students
      EXECUTE format($$
        CREATE TABLE %I.students (
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

      EXECUTE format('CREATE INDEX ON %I.students(class_id)', p_schema);
      EXECUTE format('CREATE INDEX ON %I.students(admission_no)', p_schema);

      -- parent_accounts
      EXECUTE format($$
        CREATE TABLE %I.parent_accounts (
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
        CREATE TABLE %I.attendance (
          id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          student_id     UUID NOT NULL,
          date           DATE NOT NULL,
          check_in_time  TIMESTAMPTZ,
          check_out_time TIMESTAMPTZ,
          status         VARCHAR(20) NOT NULL DEFAULT 'present'
                           CHECK (status IN ('present','absent','late','half_day','holiday')),
          mode           VARCHAR(20) DEFAULT 'manual'
                           CHECK (mode IN ('qr','biometric','manual')),
          marked_by      UUID,
          parent_notified BOOLEAN NOT NULL DEFAULT false,
          notified_at    TIMESTAMPTZ,
          notes          TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(student_id, date)
        )
      $$, p_schema);

      EXECUTE format('CREATE INDEX ON %I.attendance(date)', p_schema);
      EXECUTE format('CREATE INDEX ON %I.attendance(student_id)', p_schema);

      -- fee_structures
      EXECUTE format($$
        CREATE TABLE %I.fee_structures (
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

      -- fee_invoices
      EXECUTE format($$
        CREATE TABLE %I.fee_invoices (
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
          razorpay_order_id TEXT,
          paid_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
          paid_at           TIMESTAMPTZ,
          payment_method    VARCHAR(30) CHECK (payment_method IN ('razorpay','cash','bank_transfer','cheque')),
          created_by        UUID,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      $$, p_schema);

      EXECUTE format('CREATE INDEX ON %I.fee_invoices(student_id)', p_schema);
      EXECUTE format('CREATE INDEX ON %I.fee_invoices(status)', p_schema);
      EXECUTE format('CREATE INDEX ON %I.fee_invoices(due_date)', p_schema);

      -- announcements
      EXECUTE format($$
        CREATE TABLE %I.announcements (
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
        CREATE TABLE %I.messages (
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

      EXECUTE format('CREATE INDEX ON %I.messages(sender_id, sender_type)', p_schema);
      EXECUTE format('CREATE INDEX ON %I.messages(recipient_id, recipient_type)', p_schema);

      -- audit_logs
      EXECUTE format($$
        CREATE TABLE %I.audit_logs (
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

      EXECUTE format('CREATE INDEX ON %I.audit_logs(ts DESC)', p_schema);
      EXECUTE format('CREATE INDEX ON %I.audit_logs(entity, entity_id)', p_schema);

    END;
    $fn$;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS public.create_tenant_schema(text)');
};
