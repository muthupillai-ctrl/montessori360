import crypto from 'crypto';
import { getPool } from '../../config/database.js';

export interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string;
  tenant_schema: string;
  created_by: string | null;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

class IntegrationService {

  private hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async createKey(tenantSchema: string, name: string, createdBy: string): Promise<{ row: ApiKeyRow; plainKey: string }> {
    const raw       = `m360_${crypto.randomBytes(24).toString('hex')}`;
    const prefix    = raw.slice(0, 12);
    const keyHash   = this.hash(raw);

    const { rows } = await getPool().query<ApiKeyRow>(
      `INSERT INTO public.api_keys (key_prefix, key_hash, name, tenant_schema, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, key_prefix, name, tenant_schema, created_by, last_used_at, is_active, created_at`,
      [prefix, keyHash, name, tenantSchema, createdBy]
    );
    return { row: rows[0], plainKey: raw };
  }

  async listKeys(tenantSchema: string): Promise<ApiKeyRow[]> {
    const { rows } = await getPool().query<ApiKeyRow>(
      `SELECT id, key_prefix, name, tenant_schema, created_by, last_used_at, is_active, created_at
       FROM public.api_keys
       WHERE tenant_schema = $1
       ORDER BY created_at DESC`,
      [tenantSchema]
    );
    return rows;
  }

  async revokeKey(tenantSchema: string, id: string): Promise<boolean> {
    const { rowCount } = await getPool().query(
      `UPDATE public.api_keys SET is_active = false
       WHERE id = $1 AND tenant_schema = $2`,
      [id, tenantSchema]
    );
    return (rowCount ?? 0) > 0;
  }

  async deleteKey(tenantSchema: string, id: string): Promise<boolean> {
    const { rowCount } = await getPool().query(
      `DELETE FROM public.api_keys WHERE id = $1 AND tenant_schema = $2`,
      [id, tenantSchema]
    );
    return (rowCount ?? 0) > 0;
  }

  // Used by auth middleware to validate inbound API key
  async validateKey(raw: string): Promise<{ tenantSchema: string } | null> {
    const keyHash = this.hash(raw);
    const { rows } = await getPool().query<{ tenant_schema: string; id: string }>(
      `UPDATE public.api_keys
       SET last_used_at = now()
       WHERE key_hash = $1 AND is_active = true
       RETURNING tenant_schema, id`,
      [keyHash]
    );
    if (!rows.length) return null;
    return { tenantSchema: rows[0].tenant_schema };
  }
}

export const integrationService = new IntegrationService();
