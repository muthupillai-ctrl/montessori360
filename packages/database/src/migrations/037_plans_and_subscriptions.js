// Plans become manageable from the platform portal: each plan is either a flat
// price or a per-student price (with a minimum), bundles products (Taji One /
// Taji AMS) and carries monthly AI/SMS allowances. Schools get subscription
// fields (status, dates, discount). Seeds the four Taji plans and archives the
// original starter/growth/enterprise rows — archived plans stay valid for the
// schools already on them, they just aren't offered for new assignments.

exports.up = async ({ sql }) => {

  sql(`
    ALTER TABLE public.subscription_plans
      ADD COLUMN IF NOT EXISTS display_name    VARCHAR(100),
      ADD COLUMN IF NOT EXISTS description     TEXT,
      ADD COLUMN IF NOT EXISTS pricing_model   VARCHAR(20)  NOT NULL DEFAULT 'flat',
      ADD COLUMN IF NOT EXISTS billing_period  VARCHAR(20)  NOT NULL DEFAULT 'monthly',
      ADD COLUMN IF NOT EXISTS min_charge_inr  NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS includes_sis    BOOLEAN      NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS includes_ams    BOOLEAN      NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS ai_monthly_generations INTEGER,
      ADD COLUMN IF NOT EXISTS sms_monthly     INTEGER,
      ADD COLUMN IF NOT EXISTS is_public       BOOLEAN      NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS is_archived     BOOLEAN      NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sort_order      INTEGER      NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      ALTER COLUMN max_students DROP NOT NULL,   -- NULL = unlimited
      ALTER COLUMN max_staff    DROP NOT NULL;
  `);

  sql(`
    DO $$ BEGIN
      ALTER TABLE public.subscription_plans
        ADD CONSTRAINT subscription_plans_pricing_model_check CHECK (pricing_model IN ('flat','per_student'));
      ALTER TABLE public.subscription_plans
        ADD CONSTRAINT subscription_plans_billing_period_check CHECK (billing_period IN ('monthly','yearly'));
      ALTER TABLE public.subscription_plans
        ADD CONSTRAINT subscription_plans_products_check CHECK (includes_sis OR includes_ams);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  // name is already UNIQUE (subscription_plans_name_key), which ON CONFLICT below relies on.

  // Original plans: label them, keep them valid, stop offering them
  sql(`
    UPDATE public.subscription_plans
    SET    display_name = COALESCE(display_name, initcap(name) || ' (legacy)'),
           is_archived  = true,
           is_public    = false
    WHERE  name IN ('starter','growth','enterprise');
  `);

  sql(`
    INSERT INTO public.subscription_plans
      (name, display_name, description, pricing_model, billing_period, price_inr, min_charge_inr,
       max_students, max_staff, includes_sis, includes_ams, ai_monthly_generations, sms_monthly,
       features, is_public, sort_order)
    VALUES
      ('taji_one_starter', 'Taji One Starter',
       'Preschools and small schools: students, attendance, fees, parent portal, journal and messaging.',
       'flat', 'yearly', 15000, 15000, 150, 15, true, false, 20, 300,
       '{"transport":false,"staff_payroll":false,"timetable":false,"ai_insights":false}', true, 10),
      ('taji_one', 'Taji One',
       'Full school management: Starter plus staff and payroll, transport, timetable, reports and AI insights.',
       'per_student', 'yearly', 120, 20000, NULL, NULL, true, false, 50, 1000,
       '{"transport":true,"staff_payroll":true,"timetable":true,"ai_insights":true}', true, 20),
      ('taji_one_ams', 'Taji One + AMS',
       'Everything in Taji One plus Taji AMS: curriculum, child progress and AI worksheets, lesson plans and question papers.',
       'per_student', 'yearly', 200, 30000, NULL, NULL, true, true, 200, 2000,
       '{"transport":true,"staff_payroll":true,"timetable":true,"ai_insights":true}', true, 30),
      ('taji_ams', 'Taji AMS only',
       'Taji AMS for schools that run another office system.',
       'per_student', 'yearly', 100, 15000, NULL, NULL, false, true, 150, 0,
       '{}', true, 40)
    ON CONFLICT (name) DO NOTHING;
  `);

  sql(`
    ALTER TABLE public.tenants
      ADD COLUMN IF NOT EXISTS plan_status      VARCHAR(20) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS plan_started_on  DATE,
      ADD COLUMN IF NOT EXISTS renews_on        DATE,
      ADD COLUMN IF NOT EXISTS trial_ends_on    DATE,
      ADD COLUMN IF NOT EXISTS discount_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS billing_notes    TEXT;
  `);

  sql(`
    DO $$ BEGIN
      ALTER TABLE public.tenants
        ADD CONSTRAINT tenants_plan_status_check CHECK (plan_status IN ('trial','active','overdue','cancelled'));
      ALTER TABLE public.tenants
        ADD CONSTRAINT tenants_discount_pct_check CHECK (discount_pct >= 0 AND discount_pct <= 100);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
};

exports.down = async ({ sql }) => {
  sql(`
    ALTER TABLE public.tenants
      DROP CONSTRAINT IF EXISTS tenants_plan_status_check,
      DROP CONSTRAINT IF EXISTS tenants_discount_pct_check,
      DROP COLUMN IF EXISTS plan_status, DROP COLUMN IF EXISTS plan_started_on,
      DROP COLUMN IF EXISTS renews_on,   DROP COLUMN IF EXISTS trial_ends_on,
      DROP COLUMN IF EXISTS discount_pct, DROP COLUMN IF EXISTS billing_notes;
  `);
  sql(`
    DELETE FROM public.subscription_plans p
    WHERE  p.name IN ('taji_one_starter','taji_one','taji_one_ams','taji_ams')
      AND  NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.subscription_plan_id = p.id);
  `);
  sql(`
    ALTER TABLE public.subscription_plans
      DROP CONSTRAINT IF EXISTS subscription_plans_pricing_model_check,
      DROP CONSTRAINT IF EXISTS subscription_plans_billing_period_check,
      DROP CONSTRAINT IF EXISTS subscription_plans_products_check,
      DROP COLUMN IF EXISTS display_name,  DROP COLUMN IF EXISTS description,
      DROP COLUMN IF EXISTS pricing_model, DROP COLUMN IF EXISTS billing_period,
      DROP COLUMN IF EXISTS min_charge_inr, DROP COLUMN IF EXISTS includes_sis,
      DROP COLUMN IF EXISTS includes_ams,  DROP COLUMN IF EXISTS ai_monthly_generations,
      DROP COLUMN IF EXISTS sms_monthly,   DROP COLUMN IF EXISTS is_public,
      DROP COLUMN IF EXISTS is_archived,   DROP COLUMN IF EXISTS sort_order,
      DROP COLUMN IF EXISTS updated_at;
  `);
};
