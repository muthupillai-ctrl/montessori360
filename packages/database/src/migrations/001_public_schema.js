exports.up = async (pgm) => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS public.subscription_plans (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        VARCHAR(50) NOT NULL UNIQUE,
      max_students INTEGER NOT NULL DEFAULT 100,
      max_staff   INTEGER NOT NULL DEFAULT 10,
      features    JSONB NOT NULL DEFAULT '{}',
      price_inr   NUMERIC(10,2) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  pgm.sql(`
    INSERT INTO public.subscription_plans (name, max_students, max_staff, features, price_inr)
    VALUES
      ('starter',    100,  10,  '{"push_notifications":true,"sms":false,"whatsapp":false,"transport":false,"multi_branch":false}',  999.00),
      ('growth',     500,  50,  '{"push_notifications":true,"sms":true,"whatsapp":false,"transport":true,"multi_branch":false}',   2999.00),
      ('enterprise', 9999, 9999,'{"push_notifications":true,"sms":true,"whatsapp":true,"transport":true,"multi_branch":true}',     7999.00)
    ON CONFLICT (name) DO NOTHING
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS public.tenants (
      id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code                 VARCHAR(20) NOT NULL UNIQUE,
      name                 VARCHAR(255) NOT NULL,
      schema_name          VARCHAR(63) NOT NULL UNIQUE,
      subscription_plan_id UUID REFERENCES public.subscription_plans(id),
      owner_name           VARCHAR(255) NOT NULL,
      owner_email          VARCHAR(255) NOT NULL,
      owner_phone          VARCHAR(20),
      address              TEXT,
      city                 VARCHAR(100),
      state                VARCHAR(100),
      gstin                VARCHAR(20),
      logo_url             TEXT,
      timezone             VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
      academic_year_start  VARCHAR(10) NOT NULL DEFAULT '06-01',
      is_active            BOOLEAN NOT NULL DEFAULT true,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_tenants_code ON public.tenants(code)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_tenants_schema ON public.tenants(schema_name)`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS public.platform_admins (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          VARCHAR(255) NOT NULL,
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS public.platform_admins CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS public.tenants CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS public.subscription_plans CASCADE`);
};
