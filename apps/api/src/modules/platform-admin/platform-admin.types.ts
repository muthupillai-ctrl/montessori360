export interface PlatformAdminRow {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantRow {
  id: string;
  code: string;
  name: string;
  schema_name: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  plan_name?: string;
  student_count?: number;
  staff_count?: number;
}

export interface CreateTenantDto {
  code: string;
  name: string;
  owner_name: string;
  owner_email: string;
  owner_phone?: string;
  owner_password: string;
  plan_id?: string;      // UUID of subscription_plan row
  plan?: string;         // plan name fallback
  city?: string;
  state?: string;
  address?: string;
  timezone?: string;
}

export interface UpdateTenantDto {
  name?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  city?: string;
  state?: string;
  address?: string;
  timezone?: string;
}

export interface PlatformJwtPayload {
  sub: string;
  role: 'platform_admin';
  email: string;
  name: string;
  iat: number;
  exp: number;
}
