import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const parentSchema = z.object({
  relation:             z.enum(['father', 'mother', 'guardian', 'step_father', 'step_mother', 'other']),
  first_name:           z.string().min(1).max(100),
  last_name:            z.string().max(100).optional(),
  mobile:               z.string().min(1).max(20).optional(),
  email:                z.string().email().optional().or(z.literal('')),
  mobile_alt:           z.string().optional(),
  is_primary:           z.boolean().optional(),
  is_emergency_contact: z.boolean().optional(),
  can_pickup:           z.boolean().optional(),
  address_line1:        z.string().max(200).optional(),
  address_line2:        z.string().max(200).optional(),
  city:                 z.string().max(100).optional(),
  state:                z.string().max(100).optional(),
  country:              z.string().max(100).optional(),
  pincode:              z.string().max(10).optional(),
  profession:           z.string().max(100).optional(),
  employer:             z.string().max(200).optional(),
  annual_income:        z.number().int().positive().optional(),
  education:            z.string().max(50).optional(),
  notes:                z.string().max(1000).optional(),
});

const medicalNotesSchema = z.object({
  conditions:   z.array(z.string()).optional(),
  medications:  z.array(z.string()).optional(),
  doctor_name:  z.string().optional(),
  doctor_phone: z.string().optional(),
  notes:        z.string().optional(),
}).optional();

// ── Main schemas ──────────────────────────────────────────────────────────────

export const createStudentSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name:  z.string().max(100).optional(),
  dob:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  gender:     z.enum(['male', 'female', 'other']).optional(),
  class_id:   z.string().uuid('Invalid class ID').optional(),

  blood_group:   z.string().max(5).optional(),
  nationality:   z.string().max(50).default('Indian'),
  mother_tongue: z.string().max(100).optional(),
  aadhar_no:     z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),

  parents: z.array(parentSchema).min(1, 'At least one parent is required').optional(),
  medical_notes:      medicalNotesSchema,
  dietary_notes:      z.string().max(500).optional(),
  allergies:          z.array(z.string()).optional(),
  previous_school:    z.string().max(255).optional(),
  admission_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  transport_route_id: z.string().uuid().optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

const boolParam = z.preprocess((v) => v === 'false' ? false : v === 'true' ? true : v, z.boolean());

export const studentFiltersSchema = z.object({
  class_id:  z.string().uuid().optional(),
  is_active: boolParam.optional(),
  no_class:  boolParam.optional(),
  search:    z.string().max(100).optional(),
  rfid_uid:  z.string().max(50).optional(),
  page:      z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:     z.preprocess(Number, z.number().int().min(1).max(500)).optional().default(20),
});

export const assignClassSchema = z.object({
  class_id: z.string().uuid('Invalid class ID'),
});

export const linkSiblingsSchema = z.object({
  student_id_a: z.string().uuid(),
  student_id_b: z.string().uuid(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid student ID'),
});

// ── Middleware factory ────────────────────────────────────────────────────────

function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      _res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    // Express 5 — req.query is read-only, store parsed values on req object
    (req as any).parsedQuery = result.data;
    next();
  };
}

function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid route parameter',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    next();
  };
}

export const validateCreateStudent  = validateBody(createStudentSchema);
export const validateUpdateStudent  = validateBody(updateStudentSchema);
export const validateStudentFilters = validateQuery(studentFiltersSchema);
export const validateAssignClass    = validateBody(assignClassSchema);
export const validateLinkSiblings   = validateBody(linkSiblingsSchema);
export const validateStudentId      = validateParams(uuidParamSchema);
