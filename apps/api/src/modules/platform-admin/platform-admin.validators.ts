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
  plan:           z.enum(['starter', 'growth', 'enterprise']).optional(),
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
