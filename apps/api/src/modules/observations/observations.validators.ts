import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const isoDate      = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const gradeSchema  = z.enum(['not_started', 'in_progress', 'led', 'mastered']);

export const createDomainSchema = z.object({
  name:        z.string().min(1).max(100),
  code:        z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Code must be lowercase letters, numbers, underscores only'),
  description: z.string().max(500).optional(),
  sort_order:  z.number().int().min(0).optional().default(0),
});

export const createMilestoneSchema = z.object({
  domain_id:   z.string().uuid(),
  code:        z.string().min(1).max(20),
  name:        z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  age_min:     z.number().int().min(0).max(216).optional(),  // months, max 18 years
  age_max:     z.number().int().min(0).max(216).optional(),
  sort_order:  z.number().int().min(0).optional().default(0),
});

export const recordObservationSchema = z.object({
  student_id:   z.string().uuid(),
  milestone_id: z.string().uuid(),
  grade:        gradeSchema,
  notes:        z.string().max(1000).optional(),
  observed_on:  isoDate.optional(),
});

export const bulkObservationSchema = z.object({
  student_id:   z.string().uuid(),
  observed_on:  isoDate.optional(),
  observations: z.array(z.object({
    milestone_id: z.string().uuid(),
    grade:        gradeSchema,
    notes:        z.string().max(1000).optional(),
  })).min(1, 'At least one observation required'),
});

export const observationFiltersSchema = z.object({
  student_id:  z.string().uuid().optional(),
  domain_id:   z.string().uuid().optional(),
  grade:       gradeSchema.optional(),
  date_from:   isoDate.optional(),
  date_to:     isoDate.optional(),
  page:        z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:       z.preprocess(Number, z.number().int().min(1).max(100)).optional().default(50),
});

// ── Middleware ─────────────────────────────────────────────────────────────────

function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: result.error.flatten().fieldErrors },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: result.error.flatten().fieldErrors },
      });
      return;
    }
    (req as any).parsedQuery = result.data;
    next();
  };
}

export const validateCreateDomain      = validateBody(createDomainSchema);
export const validateCreateMilestone   = validateBody(createMilestoneSchema);
export const validateRecordObservation = validateBody(recordObservationSchema);
export const validateBulkObservation   = validateBody(bulkObservationSchema);
export const validateObservationFilters = validateQuery(observationFiltersSchema);
