import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler.js';

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

const createTenantSchema = z.object({
  code:           z.string().min(3).max(20).regex(/^[a-zA-Z0-9]+$/, 'Code must be alphanumeric'),
  name:           z.string().min(3).max(255),
  owner_name:     z.string().min(2).max(255),
  owner_email:    z.string().email(),
  owner_phone:    z.string().max(20).optional(),
  owner_password: z.string().min(8, 'Password must be at least 8 characters'),
  plan_id:        z.string().uuid().optional(),
  plan:           z.string().max(50).optional(),
  city:           z.string().max(100).optional(),
  state:          z.string().max(100).optional(),
  address:        z.string().max(500).optional(),
  timezone:       z.string().optional().default('Asia/Kolkata'),
});

const updateTenantSchema = z.object({
  name:        z.string().min(3).max(255).optional(),
  owner_name:  z.string().min(2).max(255).optional(),
  owner_email: z.string().email().optional(),
  owner_phone: z.string().max(20).optional(),
  city:        z.string().max(100).optional(),
  state:       z.string().max(100).optional(),
  address:     z.string().max(500).optional(),
  timezone:    z.string().optional(),
});

const createOwnerSchema = z.object({
  first_name: z.string().trim().min(2).max(100),
  last_name:  z.string().trim().max(100).optional(),
  email:      z.string().trim().email(),
  phone:      z.string().trim().max(20).optional(),
  password:   z.string().min(8, 'Password must be at least 8 characters'),
});

const updateOwnerSchema = z.object({
  first_name: z.string().trim().min(2).max(100).optional(),
  last_name:  z.string().trim().max(100).optional(),
  email:      z.string().trim().email().optional(),
  phone:      z.string().trim().max(20).nullable().optional(),
  is_active:  z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'No fields to update' });

const money = z.coerce.number().min(0).max(10_000_000);
const optLimit = z.coerce.number().int().min(1).max(1_000_000).nullable().optional();

const planFields = {
  display_name:   z.string().trim().min(2).max(100),
  description:    z.string().trim().max(1000).nullable().optional(),
  pricing_model:  z.enum(['flat', 'per_student']),
  billing_period: z.enum(['monthly', 'yearly']),
  price_inr:      money,
  min_charge_inr: money.optional(),
  max_students:   optLimit,
  max_staff:      optLimit,
  includes_sis:   z.boolean(),
  includes_ams:   z.boolean(),
  ai_monthly_generations: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  sms_monthly:    z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  features:       z.object({
    staff_payroll: z.boolean(), transport: z.boolean(), timetable: z.boolean(), ai_insights: z.boolean(),
  }).partial().optional(),
  is_public:      z.boolean().optional(),
  sort_order:     z.coerce.number().int().min(0).max(10_000).optional(),
};

const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(50).regex(/^[a-z0-9_]+$/, 'Code must be lowercase letters, digits or _'),
  ...planFields,
}).refine(p => p.includes_sis || p.includes_ams, { message: 'A plan must include Taji One or Taji AMS' });

const updatePlanSchema = z.object(planFields).partial()
  .refine(v => Object.keys(v).length > 0, { message: 'No fields to update' });

const updateSubscriptionSchema = z.object({
  plan_id:         z.string().uuid().optional(),
  plan_status:     z.enum(['trial', 'active', 'overdue', 'cancelled']).optional(),
  plan_started_on: z.string().date().nullable().optional(),
  renews_on:       z.string().date().nullable().optional(),
  trial_ends_on:   z.string().date().nullable().optional(),
  discount_pct:    z.coerce.number().min(0).max(100).optional(),
  billing_notes:   z.string().max(2000).nullable().optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'No fields to update' });

function validate(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(AppError.badRequest(result.error.errors.map(e => e.message).join(', ')));
    }
    req.body = result.data;
    next();
  };
}

export const validateLogin        = validate(loginSchema);
export const validateCreateTenant = validate(createTenantSchema);
export const validateUpdateTenant = validate(updateTenantSchema);
export const validateCreateOwner  = validate(createOwnerSchema);
export const validateUpdateOwner  = validate(updateOwnerSchema);
export const validateCreatePlan   = validate(createPlanSchema);
export const validateUpdatePlan   = validate(updatePlanSchema);
export const validateUpdateSubscription = validate(updateSubscriptionSchema);
export const validateResetStaffPassword = validate(z.object({ password: z.string().min(8, 'Password must be at least 8 characters') }));
