import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, tenantQuery } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { JwtPayload } from '../../middleware/auth.js';
import { sendPasswordResetEmail } from '../../utils/email.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

interface TenantRow {
  id: string;
  schema_name: string;
  name: string;
  is_active: boolean;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string; name: string; tenantId: string; tenantName: string };
}

class AuthService {
  // ── Login ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string, tenantCode: string): Promise<TokenPair> {
    // 1. Resolve tenant
    const [tenant] = await query<TenantRow>(
      `SELECT id, schema_name, name, is_active FROM public.tenants WHERE code = $1`,
      [tenantCode.toLowerCase()]
    );
    if (!tenant || !tenant.is_active) throw AppError.unauthorized('Invalid school code or inactive account');

    // 2. Find user in tenant schema
    const [user] = await tenantQuery<UserRow>(
      tenant.schema_name,
      `SELECT id, email, password_hash, role, first_name, last_name, is_active
       FROM staff WHERE email = $1`,
      [email.toLowerCase()]
    );

    // Also check parent table if not found in staff
    const actor = user ?? await this.findParent(tenant.schema_name, email);
    if (!actor || !actor.is_active) throw AppError.unauthorized('Invalid credentials');

    // 3. Verify password
    const valid = await bcrypt.compare(password, actor.password_hash);
    if (!valid) throw AppError.unauthorized('Invalid credentials');

    // 4. Issue tokens
    return this.issueTokens(actor, tenant);
  }

  private async findParent(schema: string, email: string): Promise<UserRow | null> {
    const rows = await tenantQuery<UserRow>(
      schema,
      `SELECT id, email, password_hash, 'parent' AS role, first_name, last_name, is_active
       FROM parent_accounts WHERE email = $1`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  }

  // ── Token issuance ─────────────────────────────────────────────────────────
  private async issueTokens(user: UserRow, tenant: TenantRow): Promise<TokenPair> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: tenant.id,
      tenantSchema: tenant.schema_name,
      role: user.role,
      email: user.email,
    };

  const accessToken = jwt.sign( payload,
  process.env.JWT_ACCESS_SECRET as string,
  {
    expiresIn: '15m',
  }
);

    const refreshToken = uuidv4();
    const userType = user.role === 'parent' ? 'parent' : 'staff';
    await cacheSet(
      `refresh:${refreshToken}`,
      { userId: user.id, tenantId: tenant.id, userType },
      7 * 24 * 3600
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: `${user.first_name} ${user.last_name}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
      },
    };
  }

  // ── Refresh ────────────────────────────────────────────────────────────────
  async refreshTokens(refreshToken?: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) throw AppError.unauthorized('No refresh token provided');

    const stored = await cacheGet<{ userId: string; tenantId: string; userType?: string }>(`refresh:${refreshToken}`);
    if (!stored) throw AppError.unauthorized('Invalid or expired refresh token');

    const { userId, tenantId, userType } = stored;

    const [tenant] = await query<TenantRow>(
      `SELECT id, schema_name, name, is_active FROM public.tenants WHERE id = $1`,
      [tenantId]
    );
    if (!tenant || !tenant.is_active) throw AppError.unauthorized('Tenant inactive');

    let user: UserRow | undefined;

    if (userType === 'parent') {
      const rows = await tenantQuery<UserRow>(
        tenant.schema_name,
        `SELECT id, email, password_hash, 'parent' AS role, first_name, last_name, is_active
         FROM parent_accounts WHERE id = $1`,
        [userId]
      );
      user = rows[0];
    } else {
      const rows = await tenantQuery<UserRow>(
        tenant.schema_name,
        `SELECT id, email, password_hash, role, first_name, last_name, is_active FROM staff WHERE id = $1`,
        [userId]
      );
      user = rows[0];
      // Fallback: token was issued before userType was stored — check parent_accounts too
      if (!user) {
        const parentRows = await tenantQuery<UserRow>(
          tenant.schema_name,
          `SELECT id, email, password_hash, 'parent' AS role, first_name, last_name, is_active
           FROM parent_accounts WHERE id = $1`,
          [userId]
        );
        user = parentRows[0];
      }
    }

    if (!user || !user.is_active) throw AppError.unauthorized('User inactive');

    await cacheDel(`refresh:${refreshToken}`);
    return this.issueTokens(user, tenant);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await cacheDel(`refresh:${refreshToken}`);
    }
  }

  // ── Forgot / reset password ────────────────────────────────────────────────
  async forgotPassword(email: string, tenantCode: string): Promise<void> {
    const [tenant] = await query<TenantRow>(`SELECT id, schema_name FROM public.tenants WHERE code = $1`, [tenantCode.toLowerCase()]);
    if (!tenant) return; // Silently ignore — no enumeration

    const lowerEmail = email.toLowerCase();

    // Check staff first, then parent accounts
    const [staff] = await tenantQuery<UserRow>(
      tenant.schema_name,
      `SELECT id, email FROM staff WHERE email = $1 AND is_active = true`,
      [lowerEmail]
    );
    console.log('[forgotPassword] staff found:', !!staff);

    const [parent] = !staff
      ? await tenantQuery<UserRow>(
          tenant.schema_name,
          `SELECT id, email, is_active FROM parent_accounts WHERE email = $1`,
          [lowerEmail]
        )
      : [undefined];
    console.log('[forgotPassword] parent found:', !!parent, 'is_active:', (parent as any)?.is_active);

    const actor = staff ?? parent;
    if (!actor) {
      console.log('[forgotPassword] no account found for', lowerEmail);
      return;
    }
    console.log('[forgotPassword] sending reset to', lowerEmail, 'as', staff ? 'staff' : 'parent');

    const userType = staff ? 'staff' : 'parent';
    const resetToken = uuidv4();
    await cacheSet(`pwreset:${resetToken}`, { userId: actor.id, tenantSchema: tenant.schema_name, userType }, 3600);

    const appUrl = process.env.APP_URL ?? 'http://localhost:4200';
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(actor.email, resetLink);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await cacheGet<{ userId: string; tenantSchema: string; userType?: string }>(`pwreset:${token}`);
    if (!stored) throw AppError.badRequest('Invalid or expired reset token');

    const hash = await bcrypt.hash(newPassword, 12);
    if (stored.userType === 'parent') {
      await tenantQuery(stored.tenantSchema,
        `UPDATE parent_accounts SET password_hash = $1, is_active = true, updated_at = NOW() WHERE id = $2`,
        [hash, stored.userId]
      );
    } else {
      await tenantQuery(stored.tenantSchema,
        `UPDATE staff SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hash, stored.userId]
      );
    }

    await cacheDel(`pwreset:${token}`);
  }

  // ── Parent invite ──────────────────────────────────────────────────────────
  async inviteParent(schema: string, studentId: string, parentId: string): Promise<string> {
    // Verify parent exists and belongs to this student
    const [parent] = await tenantQuery<{ id: string; email: string }>(
      schema,
      `SELECT pa.id, pa.email
       FROM parent_accounts pa
       WHERE pa.id = $1 AND $2 = ANY(pa.student_ids)`,
      [parentId, studentId]
    );
    if (!parent) throw AppError.notFound('Parent account not found for this student');

    const token = uuidv4();
    await cacheSet(`invite:${token}`, { parentId: parent.id, tenantSchema: schema }, 72 * 3600);
    return token;
  }

  async createParentAccount(
    schema: string,
    studentId: string,
    data: { email: string; first_name: string; last_name: string; phone: string; relation: string }
  ): Promise<{ id: string; inviteToken: string }> {
    const placeholder = await bcrypt.hash(uuidv4(), 10);

    // Upsert: if email already exists, just append the studentId to their array
    const [pa] = await tenantQuery<{ id: string }>(
      schema,
      `INSERT INTO parent_accounts (email, password_hash, first_name, last_name, phone, relation, student_ids, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, ARRAY[$7::uuid], false)
       ON CONFLICT (email) DO UPDATE
         SET student_ids = CASE
               WHEN $7::uuid = ANY(parent_accounts.student_ids)
               THEN parent_accounts.student_ids
               ELSE array_append(parent_accounts.student_ids, $7::uuid)
             END,
             updated_at = now()
       RETURNING id`,
      [data.email.toLowerCase(), placeholder, data.first_name, data.last_name, data.phone, data.relation, studentId]
    );

    const token = uuidv4();
    await cacheSet(`invite:${token}`, { parentId: pa.id, tenantSchema: schema }, 72 * 3600);
    return { id: pa.id, inviteToken: token };
  }

  async togglePortalAccount(schema: string, accountId: string, isActive: boolean): Promise<void> {
    const rows = await tenantQuery<{ id: string }>(schema,
      `UPDATE parent_accounts SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING id`,
      [isActive, accountId]
    );
    if (!rows.length) throw AppError.notFound('Portal account');
  }

  async resendParentInvite(schema: string, accountId: string): Promise<string> {
    const [pa] = await tenantQuery<{ id: string; email: string; first_name: string; last_name: string }>(
      schema,
      `SELECT id, email, first_name, last_name FROM parent_accounts WHERE id = $1`,
      [accountId]
    );
    if (!pa) throw AppError.notFound('Portal account');

    const token = uuidv4();
    await cacheSet(`invite:${token}`, { parentId: pa.id, tenantSchema: schema }, 72 * 3600);
    return token;
  }

  async setPasswordFromInvite(token: string, newPassword: string): Promise<void> {
    const stored = await cacheGet<{ parentId: string; tenantSchema: string }>(`invite:${token}`);
    if (!stored) throw AppError.badRequest('Invite link has expired or is invalid');

    const hash = await bcrypt.hash(newPassword, 12);
    const rows = await tenantQuery<{ id: string }>(
      stored.tenantSchema,
      `UPDATE parent_accounts SET password_hash = $1, is_active = true, updated_at = now()
       WHERE id = $2 RETURNING id`,
      [hash, stored.parentId]
    );
    if (!rows.length) throw AppError.notFound('Parent account');

    await cacheDel(`invite:${token}`);
  }
}

export const authService = new AuthService();
