import { query, tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';

// Plan limits are enforced softly: nothing is blocked, schools and the platform
// portal just see warnings. Estimates are annual, in INR, after discount.

export interface PlanRow {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  pricing_model: 'flat' | 'per_student';
  billing_period: 'monthly' | 'yearly';
  price_inr: string;          // NUMERIC arrives as string
  min_charge_inr: string;
  max_students: number | null;
  max_staff: number | null;
  includes_sis: boolean;
  includes_ams: boolean;
  ai_monthly_generations: number | null;
  sms_monthly: number | null;
  features: Record<string, boolean>;
  is_public: boolean;
  is_archived: boolean;
  sort_order: number;
}

export interface SubscriptionFields {
  plan_status: 'trial' | 'active' | 'overdue' | 'cancelled';
  plan_started_on: string | Date | null;
  renews_on: string | Date | null;
  trial_ends_on: string | Date | null;
  discount_pct: string;
}

export interface Usage {
  students: number;
  staff: number;
  ai_generations_month: number;
  ai_cost_month_usd: number;
}

export interface Warning {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface SubscriptionSummary {
  plan: Pick<PlanRow, 'id' | 'name' | 'display_name' | 'pricing_model' | 'billing_period' | 'max_students' | 'max_staff'
    | 'includes_sis' | 'includes_ams' | 'ai_monthly_generations' | 'sms_monthly'> | null;
  subscription: SubscriptionFields;
  usage: Usage;
  annual_estimate_inr: number | null;
  warnings: Warning[];
}

/** Annual charge for a plan at a given student count, after discount. */
export function annualEstimate(plan: PlanRow, students: number, discountPct: number): number {
  const price = Number(plan.price_inr);
  const periods = plan.billing_period === 'monthly' ? 12 : 1;
  const perPeriod = plan.pricing_model === 'per_student'
    ? Math.max(Number(plan.min_charge_inr), price * students)
    : Math.max(Number(plan.min_charge_inr), price);
  return Math.round(perPeriod * periods * (1 - discountPct / 100));
}

export async function tenantUsage(schema: string): Promise<Usage> {
  let students = 0, staff = 0;
  try {
    const [c] = await tenantQuery<{ students: number; staff: number }>(schema, `
      SELECT (SELECT count(*)::int FROM students WHERE is_active) AS students,
             (SELECT count(*)::int FROM staff    WHERE is_active) AS staff`);
    students = c.students; staff = c.staff;
  } catch { /* schema missing or not provisioned */ }

  let ai = { n: 0, cost: 0 };
  try {
    const [r] = await query<{ n: number; cost: string }>(`
      SELECT count(*)::int AS n, COALESCE(sum(cost_usd), 0) AS cost
      FROM   public.ai_usage_log
      WHERE  tenant_schema = $1 AND created_at >= date_trunc('month', now())`, [schema]);
    ai = { n: r.n, cost: Number(r.cost) };
  } catch { /* usage table not created yet */ }

  return { students, staff, ai_generations_month: ai.n, ai_cost_month_usd: Math.round(ai.cost * 100) / 100 };
}

/** Whole days from today to a DATE column value (pg returns DATE as a Date at local midnight). */
function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const day = date instanceof Date
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
    : new Date(`${String(date).slice(0, 10)}T00:00:00`);
  const today = new Date(new Date().toDateString());
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

export function buildWarnings(plan: PlanRow | null, sub: SubscriptionFields, usage: Usage): Warning[] {
  const w: Warning[] = [];
  if (!plan) w.push({ code: 'no_plan', severity: 'warning', message: 'No plan assigned.' });

  const limit = (used: number, max: number | null, what: string, code: string) => {
    if (max == null || max <= 0) return;
    if (used > max) w.push({ code: `over_${code}`, severity: 'critical', message: `${used} active ${what}, above the plan limit of ${max}.` });
    else if (used >= Math.ceil(max * 0.9)) w.push({ code: `near_${code}`, severity: 'warning', message: `${used} of ${max} ${what} used.` });
  };
  if (plan) {
    limit(usage.students, plan.max_students, 'students', 'student_limit');
    limit(usage.staff, plan.max_staff, 'staff', 'staff_limit');
    limit(usage.ai_generations_month, plan.ai_monthly_generations, 'AI generations this month', 'ai_limit');
  }

  if (sub.plan_status === 'trial') {
    const d = daysUntil(sub.trial_ends_on);
    if (d != null && d < 0) w.push({ code: 'trial_ended', severity: 'critical', message: `Trial ended ${-d} day(s) ago.` });
    else if (d != null && d <= 7) w.push({ code: 'trial_ending', severity: 'warning', message: `Trial ends in ${d} day(s).` });
  }
  if (sub.plan_status === 'overdue') w.push({ code: 'overdue', severity: 'critical', message: 'Payment is overdue.' });
  if (sub.plan_status === 'cancelled') w.push({ code: 'cancelled', severity: 'critical', message: 'Subscription is cancelled.' });
  if (sub.plan_status === 'active') {
    const d = daysUntil(sub.renews_on);
    if (d != null && d < 0) w.push({ code: 'renewal_passed', severity: 'critical', message: `Renewal date passed ${-d} day(s) ago.` });
    else if (d != null && d <= 30) w.push({ code: 'renewal_due', severity: 'info', message: `Renews in ${d} day(s).` });
  }
  return w;
}

export async function summaryForTenant(tenantId: string): Promise<SubscriptionSummary> {
  const [t] = await query<SubscriptionFields & { schema_name: string; subscription_plan_id: string | null }>(`
    SELECT schema_name, subscription_plan_id, plan_status, plan_started_on, renews_on, trial_ends_on, discount_pct
    FROM   public.tenants WHERE id = $1`, [tenantId]);
  if (!t) throw AppError.notFound('School');

  const [plan] = t.subscription_plan_id
    ? await query<PlanRow>(`SELECT * FROM public.subscription_plans WHERE id = $1`, [t.subscription_plan_id])
    : [];
  const usage = await tenantUsage(t.schema_name);
  const sub: SubscriptionFields = {
    plan_status: t.plan_status, plan_started_on: t.plan_started_on, renews_on: t.renews_on,
    trial_ends_on: t.trial_ends_on, discount_pct: t.discount_pct,
  };
  return {
    plan: plan ? {
      id: plan.id, name: plan.name, display_name: plan.display_name, pricing_model: plan.pricing_model,
      billing_period: plan.billing_period, max_students: plan.max_students, max_staff: plan.max_staff,
      includes_sis: plan.includes_sis, includes_ams: plan.includes_ams,
      ai_monthly_generations: plan.ai_monthly_generations, sms_monthly: plan.sms_monthly,
    } : null,
    subscription: sub,
    usage,
    annual_estimate_inr: plan ? annualEstimate(plan, usage.students, Number(t.discount_pct)) : null,
    warnings: buildWarnings(plan ?? null, sub, usage),
  };
}
