import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, tenantQuery } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { JwtPayload } from '../../middleware/auth.js';

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
  user: { id: string; email: string; role: string; name: string; tenantId: string };
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

    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY ?? '15m',
    });

    const refreshToken = uuidv4();
    // Store refresh token keyed by the token itself for O(1) lookup
    await cacheSet(
      `refresh:${refreshToken}`,
      { userId: user.id, tenantId: tenant.id },
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
      },
    };
  }

  // ── Refresh ────────────────────────────────────────────────────────────────
  async refreshTokens(refreshToken?: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) throw AppError.unauthorized('No refresh token provided');

    const stored = await cacheGet<{ userId: string; tenantId: string }>(`refresh:${refreshToken}`);
    if (!stored) throw AppError.unauthorized('Invalid or expired refresh token');

    const { userId, tenantId } = stored;

    const [tenant] = await query<TenantRow>(
      `SELECT id, schema_name, name, is_active FROM public.tenants WHERE id = $1`,
      [tenantId]
    );
    if (!tenant || !tenant.is_active) throw AppError.unauthorized('Tenant inactive');

    const [user] = await tenantQuery<UserRow>(
      tenant.schema_name,
      `SELECT id, email, password_hash, role, first_name, last_name, is_active FROM staff WHERE id = $1`,
      [userId]
    );
    if (!user || !user.is_active) throw AppError.unauthorized('User inactive');

    // Rotate: delete old token, issue new pair
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

    const [user] = await tenantQuery<UserRow>(
      tenant.schema_name,
      `SELECT id, email FROM staff WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()]
    );
    if (!user) return;

    const resetToken = uuidv4();
    await cacheSet(`pwreset:${resetToken}`, { userId: user.id, tenantSchema: tenant.schema_name }, 3600); // 1 hour TTL

    // TODO: dispatch SES email with reset link
    // await emailService.sendPasswordReset(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await cacheGet<{ userId: string; tenantSchema: string }>(`pwreset:${token}`);
    if (!stored) throw AppError.badRequest('Invalid or expired reset token');

    const hash = await bcrypt.hash(newPassword, 12);
    await tenantQuery(
      stored.tenantSchema,
      `UPDATE staff SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, stored.userId]
    );

    await cacheDel(`pwreset:${token}`);
  }
}

export const authService = new AuthService();
