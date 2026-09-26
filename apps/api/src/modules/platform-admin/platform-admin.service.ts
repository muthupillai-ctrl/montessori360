import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { annualEstimate, buildWarnings, tenantUsage, type PlanRow } from '../subscription/subscription.service.js';
import type {
  PlatformAdminRow, TenantRow, OwnerRow,
  CreateTenantDto, UpdateTenantDto, CreateOwnerDto, UpdateOwnerDto, PlatformJwtPayload,
} from './platform-admin.types.js';

class PlatformAdminService {

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<{ accessToken: string; admin: { id: string; email: string; name: string } }> {
    const [admin] = await query<PlatformAdminRow>(
      `SELECT id, email, password_hash, name, is_active FROM public.platform_admins WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (!admin || !admin.is_active) throw AppError.unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(password, (admin as any).password_hash);
    if (!valid) throw AppError.unauthorized('Invalid credentials');

    const payload: Omit<PlatformJwtPayload, 'iat' | 'exp'> = {
      sub: admin.id,
      role: 'platform_admin',
      email: admin.email,
      name: admin.name,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '8h' });
    return { accessToken, admin: { id: admin.id, email: admin.email, name: admin.name } };
  }

  // ── Tenants (schools) ─────────────────────────────────────────────────────

  async listTenants(): Promise<TenantRow[]> {
    const rows = await query<TenantRow>(
      `SELECT t.*, COALESCE(sp.display_name, sp.name) AS plan_name
       FROM   public.tenants t
       LEFT JOIN public.subscription_plans sp ON sp.id = t.subscription_plan_id
       ORDER  BY t.created_at DESC`
    );
    const plans = new Map((await query<PlanRow>(`SELECT * FROM public.subscription_plans`)).map(p => [p.id, p]));
    // Attach live usage, estimate and soft-limit warnings per school
    for (const row of rows) {
      const usage = await tenantUsage(row.schema_name);
      const plan = row.subscription_plan_id ? plans.get(row.subscription_plan_id) ?? null : null;
      row.student_count = usage.students;
      row.staff_count   = usage.staff;
      row.ai_generations_month = usage.ai_generations_month;
      row.annual_estimate_inr = plan ? annualEstimate(plan, usage.students, Number(row.discount_pct)) : null;
      row.warnings = buildWarnings(plan, row, usage);
    }
    return rows;
  }

  async getTenant(id: string): Promise<TenantRow> {
    const [row] = await query<TenantRow>(
      `SELECT t.*, sp.name AS plan_name
       FROM   public.tenants t
       LEFT JOIN public.subscription_plans sp ON sp.id = t.subscription_plan_id
       WHERE  t.id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('School');

    // Add live counts from tenant schema
    try {
      const [counts] = await tenantQuery<{ student_count: string; staff_count: string }>(
        row.schema_name,
        `SELECT
           (SELECT COUNT(*)::text FROM students WHERE is_active = true)  AS student_count,
           (SELECT COUNT(*)::text FROM staff    WHERE is_active = true)  AS staff_count`
      );
      row.student_count = parseInt(counts?.student_count ?? '0');
      row.staff_count   = parseInt(counts?.staff_count   ?? '0');
    } catch {
      row.student_count = 0;
      row.staff_count   = 0;
    }
    return row;
  }

  async createTenant(dto: CreateTenantDto): Promise<TenantRow> {
    const code = dto.code.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!code) throw AppError.badRequest('Invalid school code');

    const schemaName = `tenant_${code}`;

    // Check uniqueness
    const [existing] = await query(
      `SELECT id FROM public.tenants WHERE code = $1 OR schema_name = $2`,
      [code, schemaName]
    );
    if (existing) throw AppError.conflict(`School code "${code}" is already taken`);

    // Resolve plan — accept plan_id (UUID) or plan name string
    let plan: { id: string } | undefined;
    if (dto.plan_id) {
      [plan] = await query<{ id: string }>(
        `SELECT id FROM public.subscription_plans WHERE id = $1`, [dto.plan_id]
      );
      if (!plan) throw AppError.badRequest('Selected plan not found');
    } else {
      const planName = dto.plan ?? 'taji_one_starter';
      [plan] = await query<{ id: string }>(
        `SELECT id FROM public.subscription_plans WHERE name = $1`, [planName]
      );
      if (!plan) throw AppError.badRequest(`Plan "${planName}" not found`);
    }

    // All provisioning in one transaction
    const [tenant] = await query<TenantRow>(
      `WITH inserted AS (
         INSERT INTO public.tenants
           (code, name, schema_name, subscription_plan_id, owner_name, owner_email,
            owner_phone, city, state, address, timezone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *
       )
       SELECT i.*, sp.name AS plan_name
       FROM   inserted i
       LEFT JOIN public.subscription_plans sp ON sp.id = i.subscription_plan_id`,
      [
        code, dto.name, schemaName, plan.id,
        dto.owner_name, dto.owner_email.toLowerCase(),
        dto.owner_phone ?? null, dto.city ?? null, dto.state ?? null,
        dto.address ?? null, dto.timezone ?? 'Asia/Kolkata',
      ]
    );

    // Provision schema + seed all defaults
    await query(`SELECT public.create_tenant_schema($1)`, [schemaName]);
    await query(`SELECT public.seed_tenant_defaults($1)`, [schemaName]);

    // Create owner staff account in the new tenant schema
    const passwordHash = await bcrypt.hash(dto.owner_password, 12);
    await tenantQuery(
      schemaName,
      `INSERT INTO staff (email, password_hash, role, first_name, last_name, is_active)
       VALUES ($1, $2, 'owner', $3, '', true)
       ON CONFLICT (email) DO NOTHING`,
      [dto.owner_email.toLowerCase(), passwordHash, dto.owner_name]
    );

    return tenant;
  }

  async updateTenant(id: string, dto: UpdateTenantDto): Promise<TenantRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const mapping: Record<string, unknown> = {
      name: dto.name, owner_name: dto.owner_name, owner_email: dto.owner_email,
      owner_phone: dto.owner_phone, city: dto.city, state: dto.state,
      address: dto.address, timezone: dto.timezone,
    };
    for (const [col, val] of Object.entries(mapping)) {
      if (val !== undefined) { fields.push(`${col} = $${i++}`); values.push(val); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);

    const [row] = await query<TenantRow>(
      `UPDATE public.tenants SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!row) throw AppError.notFound('School');
    return row;
  }

  async toggleActive(id: string): Promise<TenantRow> {
    const [row] = await query<TenantRow>(
      `UPDATE public.tenants SET is_active = NOT is_active, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!row) throw AppError.notFound('School');
    return row;
  }

  /** Plans offered for new schools (public, not archived). */
  async listPlans(): Promise<PlanRow[]> {
    return query<PlanRow>(
      `SELECT * FROM public.subscription_plans
       WHERE  is_public AND NOT is_archived
       ORDER  BY sort_order, price_inr`
    );
  }

  // ── Plans (platform management) ───────────────────────────────────────────

  async listAllPlans(): Promise<(PlanRow & { school_count: number })[]> {
    return query(
      `SELECT p.*, (SELECT count(*)::int FROM public.tenants t WHERE t.subscription_plan_id = p.id) AS school_count
       FROM   public.subscription_plans p
       ORDER  BY p.is_archived, p.sort_order, p.price_inr`
    );
  }

  private static readonly PLAN_COLUMNS = [
    'display_name', 'description', 'pricing_model', 'billing_period', 'price_inr', 'min_charge_inr',
    'max_students', 'max_staff', 'includes_sis', 'includes_ams', 'ai_monthly_generations', 'sms_monthly',
    'features', 'is_public', 'sort_order',
  ] as const;

  async createPlan(dto: Record<string, unknown>): Promise<PlanRow> {
    const [taken] = await query(`SELECT 1 FROM public.subscription_plans WHERE name = $1`, [dto.name]);
    if (taken) throw AppError.conflict(`Plan code "${dto.name}" already exists`);
    const cols = ['name', ...PlatformAdminService.PLAN_COLUMNS.filter(c => dto[c] !== undefined)];
    const [row] = await query<PlanRow>(
      `INSERT INTO public.subscription_plans (${cols.join(', ')})
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      cols.map(c => dto[c])
    );
    return row;
  }

  async updatePlan(id: string, dto: Record<string, unknown>): Promise<PlanRow> {
    const cols = PlatformAdminService.PLAN_COLUMNS.filter(c => dto[c] !== undefined);
    const [current] = await query<PlanRow>(`SELECT * FROM public.subscription_plans WHERE id = $1`, [id]);
    if (!current) throw AppError.notFound('Plan');
    const sis = (dto.includes_sis ?? current.includes_sis) as boolean;
    const ams = (dto.includes_ams ?? current.includes_ams) as boolean;
    if (!sis && !ams) throw AppError.badRequest('A plan must include Taji One or Taji AMS');
    const [row] = await query<PlanRow>(
      `UPDATE public.subscription_plans
       SET    ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = now()
       WHERE  id = $${cols.length + 1} RETURNING *`,
      [...cols.map(c => dto[c]), id]
    );
    return row;
  }

  async setPlanArchived(id: string, archived: boolean): Promise<PlanRow> {
    const [row] = await query<PlanRow>(
      `UPDATE public.subscription_plans SET is_archived = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [archived, id]
    );
    if (!row) throw AppError.notFound('Plan');
    return row;
  }

  async deletePlan(id: string): Promise<void> {
    const [{ n }] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.tenants WHERE subscription_plan_id = $1`, [id]
    );
    if (n > 0) throw AppError.badRequest(`${n} school(s) are on this plan. Move them to another plan or archive it instead.`);
    const rows = await query(`DELETE FROM public.subscription_plans WHERE id = $1 RETURNING id`, [id]);
    if (!rows.length) throw AppError.notFound('Plan');
  }

  async updateSubscription(tenantId: string, dto: Record<string, unknown>): Promise<TenantRow> {
    if (dto.plan_id) {
      const [plan] = await query(`SELECT 1 FROM public.subscription_plans WHERE id = $1`, [dto.plan_id]);
      if (!plan) throw AppError.badRequest('Selected plan not found');
    }
    const mapping: Record<string, string> = {
      plan_id: 'subscription_plan_id', plan_status: 'plan_status', plan_started_on: 'plan_started_on',
      renews_on: 'renews_on', trial_ends_on: 'trial_ends_on', discount_pct: 'discount_pct', billing_notes: 'billing_notes',
    };
    const keys = Object.keys(mapping).filter(k => dto[k] !== undefined);
    const [row] = await query<TenantRow>(
      `UPDATE public.tenants
       SET    ${keys.map((k, i) => `${mapping[k]} = $${i + 1}`).join(', ')}, updated_at = now()
       WHERE  id = $${keys.length + 1} RETURNING *`,
      [...keys.map(k => dto[k]), tenantId]
    );
    if (!row) throw AppError.notFound('School');
    return row;
  }

  async listSchoolAdmins(tenantId: string): Promise<{ id: string; email: string; first_name: string; last_name: string; role: string }[]> {
    const [tenant] = await query<{ schema_name: string }>(
      `SELECT schema_name FROM public.tenants WHERE id = $1`, [tenantId]
    );
    if (!tenant) throw AppError.notFound('School');

    return tenantQuery(
      tenant.schema_name,
      `SELECT id, email, first_name, last_name, role
       FROM staff
       WHERE role IN ('owner', 'principal') AND is_active = true
       ORDER BY role, first_name`
    );
  }

  // ── School owners ─────────────────────────────────────────────────────────
  // Owners are staff rows with role 'owner' in the school's schema (that is the
  // login). public.tenants.owner_* is the school's primary contact; it follows
  // the owner whose email it holds.

  private async tenantById(tenantId: string): Promise<{ schema_name: string; owner_email: string }> {
    const [tenant] = await query<{ schema_name: string; owner_email: string }>(
      `SELECT schema_name, owner_email FROM public.tenants WHERE id = $1`, [tenantId]
    );
    if (!tenant) throw AppError.notFound('School');
    return tenant;
  }

  async listOwners(tenantId: string): Promise<OwnerRow[]> {
    const tenant = await this.tenantById(tenantId);
    return tenantQuery<OwnerRow>(
      tenant.schema_name,
      `SELECT id, first_name, last_name, email, phone, is_active, created_at,
              (lower(email) = lower($1)) AS is_primary
       FROM   staff
       WHERE  role = 'owner'
       ORDER  BY is_active DESC, (lower(email) = lower($1)) DESC, first_name`,
      [tenant.owner_email]
    );
  }

  async createOwner(tenantId: string, dto: CreateOwnerDto): Promise<OwnerRow> {
    const tenant = await this.tenantById(tenantId);
    const email = dto.email.toLowerCase();
    const [taken] = await tenantQuery<{ role: string }>(
      tenant.schema_name, `SELECT role FROM staff WHERE lower(email) = $1`, [email]
    );
    if (taken) throw AppError.conflict(`${email} is already ${/^[aeiou]/.test(taken.role) ? 'an' : 'a'} ${taken.role.replace(/_/g, ' ')} account in this school`);

    const hash = await bcrypt.hash(dto.password, 12);
    const [row] = await tenantQuery<OwnerRow>(
      tenant.schema_name,
      `INSERT INTO staff (email, password_hash, role, first_name, last_name, phone, is_active)
       VALUES ($1, $2, 'owner', $3, $4, $5, true)
       RETURNING id, first_name, last_name, email, phone, is_active, created_at, false AS is_primary`,
      [email, hash, dto.first_name, dto.last_name ?? '', dto.phone ?? null]
    );
    return row;
  }

  async updateOwner(tenantId: string, staffId: string, dto: UpdateOwnerDto): Promise<OwnerRow> {
    const tenant = await this.tenantById(tenantId);
    const [current] = await tenantQuery<OwnerRow>(
      tenant.schema_name,
      `SELECT id, first_name, last_name, email, phone, is_active FROM staff WHERE id = $1 AND role = 'owner'`,
      [staffId]
    );
    if (!current) throw AppError.notFound('Owner');

    const email = dto.email?.toLowerCase();
    if (email && email !== current.email.toLowerCase()) {
      const [taken] = await tenantQuery<{ role: string }>(
        tenant.schema_name, `SELECT role FROM staff WHERE lower(email) = $1 AND id <> $2`, [email, staffId]
      );
      if (taken) throw AppError.conflict(`${email} is already ${/^[aeiou]/.test(taken.role) ? 'an' : 'a'} ${taken.role.replace(/_/g, ' ')} account in this school`);
    }
    if (dto.is_active === false && current.is_active) await this.assertAnotherActiveOwner(tenant.schema_name, staffId);

    const fields: string[] = [];
    const values: unknown[] = [];
    const mapping: Record<string, unknown> = {
      first_name: dto.first_name, last_name: dto.last_name, email, phone: dto.phone, is_active: dto.is_active,
    };
    for (const [col, val] of Object.entries(mapping)) {
      if (val !== undefined) { values.push(val); fields.push(`${col} = $${values.length}`); }
    }
    values.push(staffId);
    const [row] = await tenantQuery<OwnerRow>(
      tenant.schema_name,
      `UPDATE staff SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${values.length} AND role = 'owner'
       RETURNING id, first_name, last_name, email, phone, is_active, created_at`,
      values
    );

    // Keep the school's primary contact in step with the owner it points at
    const isPrimary = current.email.toLowerCase() === tenant.owner_email.toLowerCase();
    if (isPrimary) {
      if (row.is_active) {
        await query(
          `UPDATE public.tenants SET owner_name = $1, owner_email = $2, owner_phone = $3, updated_at = now() WHERE id = $4`,
          [`${row.first_name} ${row.last_name}`.trim(), row.email, row.phone, tenantId]
        );
      } else {
        await this.promoteNextPrimary(tenantId, tenant.schema_name);
      }
    }
    return { ...row, is_primary: isPrimary && row.is_active };
  }

  /** Deletes an owner; owners referenced by school records are deactivated instead. */
  async deleteOwner(tenantId: string, staffId: string): Promise<{ deleted: boolean; deactivated: boolean }> {
    const tenant = await this.tenantById(tenantId);
    const [current] = await tenantQuery<{ email: string; is_active: boolean }>(
      tenant.schema_name, `SELECT email, is_active FROM staff WHERE id = $1 AND role = 'owner'`, [staffId]
    );
    if (!current) throw AppError.notFound('Owner');
    if (current.is_active) await this.assertAnotherActiveOwner(tenant.schema_name, staffId);

    let result = { deleted: true, deactivated: false };
    try {
      await tenantQuery(tenant.schema_name, `DELETE FROM staff WHERE id = $1 AND role = 'owner'`, [staffId]);
    } catch (err: any) {
      if (err?.code !== '23503') throw err;   // foreign_key_violation: has history
      await tenantQuery(
        tenant.schema_name, `UPDATE staff SET is_active = false, updated_at = now() WHERE id = $1`, [staffId]
      );
      result = { deleted: false, deactivated: true };
    }
    if (current.email.toLowerCase() === tenant.owner_email.toLowerCase()) {
      await this.promoteNextPrimary(tenantId, tenant.schema_name);
    }
    return result;
  }

  private async assertAnotherActiveOwner(schema: string, staffId: string): Promise<void> {
    const [{ n }] = await tenantQuery<{ n: number }>(
      schema, `SELECT count(*)::int AS n FROM staff WHERE role = 'owner' AND is_active AND id <> $1`, [staffId]
    );
    if (n === 0) throw AppError.badRequest('A school must keep at least one active owner. Add another owner first.');
  }

  private async promoteNextPrimary(tenantId: string, schema: string): Promise<void> {
    const [next] = await tenantQuery<{ first_name: string; last_name: string; email: string; phone: string | null }>(
      schema,
      `SELECT first_name, last_name, email, phone FROM staff
       WHERE role = 'owner' AND is_active ORDER BY created_at LIMIT 1`
    );
    if (!next) return;
    await query(
      `UPDATE public.tenants SET owner_name = $1, owner_email = $2, owner_phone = $3, updated_at = now() WHERE id = $4`,
      [`${next.first_name} ${next.last_name}`.trim(), next.email, next.phone, tenantId]
    );
  }

  async resetStaffPassword(tenantId: string, staffId: string, newPassword: string): Promise<void> {
    const [tenant] = await query<{ schema_name: string }>(
      `SELECT schema_name FROM public.tenants WHERE id = $1`, [tenantId]
    );
    if (!tenant) throw AppError.notFound('School');

    const hash = await bcrypt.hash(newPassword, 12);
    const rows = await tenantQuery<{ id: string }>(
      tenant.schema_name,
      `UPDATE staff SET password_hash = $1, updated_at = now()
       WHERE id = $2 AND role IN ('owner', 'principal') RETURNING id`,
      [hash, staffId]
    );
    if (!rows.length) throw AppError.notFound('Staff admin');
  }
}

export const platformAdminService = new PlatformAdminService();
