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
  subscription_plan_id: string | null;
  plan_status: 'trial' | 'active' | 'overdue' | 'cancelled';
  plan_started_on: string | null;
  renews_on: string | null;
  trial_ends_on: string | null;
  discount_pct: string;
  billing_notes: string | null;
  plan_name?: string;
  student_count?: number;
  staff_count?: number;
  ai_generations_month?: number;
  annual_estimate_inr?: number | null;
  warnings?: { code: string; severity: string; message: string }[];
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

export interface OwnerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_primary: boolean;
  created_at: string;
}

export interface CreateOwnerDto {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  password: string;
}

export interface UpdateOwnerDto {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  is_active?: boolean;
}

export interface PlatformJwtPayload {
  sub: string;
  role: 'platform_admin';
  email: string;
  name: string;
  iat: number;
  exp: number;
}
