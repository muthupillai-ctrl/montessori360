import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const LEVELS = ['casa', 'lower_el', 'upper_el'] as const;
const STATUSES = ['not_started', 'introduced', 'practicing', 'mastered'] as const;

const createAreaSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  icon:        z.string().max(10).optional(),
  color:       z.string().regex(/^#[0-9A-Fa-f]{3,6}$/).optional(),
  sequence:    z.number().int().min(0).optional(),
});
const updateAreaSchema = createAreaSchema.partial();

const createActivitySchema = z.object({
  name:           z.string().min(1).max(255),
  description:    z.string().max(1000).optional(),
  material_name:  z.string().max(255).optional(),
  sequence:       z.number().int().min(0).optional(),
  level:          z.enum(LEVELS).optional(),
  prerequisite_id: z.string().uuid().nullable().optional(),
});
const updateActivitySchema = createActivitySchema.partial();

const upsertProgressSchema = z.object({
  status: z.enum(STATUSES),
  notes:  z.string().max(1000).nullable().optional(),
});

function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: r.error.flatten().fieldErrors } });
      return;
    }
    req.body = r.data;
    next();
  };
}

export const validateCreateArea     = validate(createAreaSchema);
export const validateUpdateArea     = validate(updateAreaSchema);
export const validateCreateActivity = validate(createActivitySchema);
export const validateUpdateActivity = validate(updateActivitySchema);
export const validateUpsertProgress = validate(upsertProgressSchema);
