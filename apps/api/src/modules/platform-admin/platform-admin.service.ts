import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  PlatformAdminRow, TenantRow,
  CreateTenantDto, UpdateTenantDto, PlatformJwtPayload,
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
      `SELECT t.*, sp.name AS plan_name
       FROM   public.tenants t
       LEFT JOIN public.subscription_plans sp ON sp.id = t.subscription_plan_id
       ORDER  BY t.created_at DESC`
    );
    // Attach live counts per tenant (best-effort; skip if schema missing)
    for (const row of rows) {
      try {
        const [counts] = await tenantQuery<{ student_count: string; staff_count: string }>(
          row.schema_name,
          `SELECT
             (SELECT COUNT(*)::text FROM students WHERE is_active = true) AS student_count,
             (SELECT COUNT(*)::text FROM staff    WHERE is_active = true) AS staff_count`
        );
        row.student_count = parseInt(counts?.student_count ?? '0');
        row.staff_count   = parseInt(counts?.staff_count   ?? '0');
      } catch {
        row.student_count = 0;
        row.staff_count   = 0;
      }
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
      const planName = dto.plan ?? 'starter';
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

  async listPlans(): Promise<any[]> {
    return query(`SELECT id, name, max_students, max_staff, price_inr, features FROM public.subscription_plans ORDER BY price_inr`);
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
