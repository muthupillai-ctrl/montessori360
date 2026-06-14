import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeHHMM = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM');

const qualificationSchema = z.object({
  degree:      z.string().min(1).max(100),
  institution: z.string().min(1).max(200),
  year:        z.number().int().min(1950).max(new Date().getFullYear()),
});

const emergencyContactSchema = z.object({
  name:     z.string().min(1).max(100),
  relation: z.string().min(1).max(50),
  phone:    z.string().regex(/^\+?[0-9]{7,15}$/),
});

export const createStaffSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(8),
  role:           z.enum(['owner','principal','teacher','assistant_teacher','accountant','driver','support','admission_staff']),
  first_name:     z.string().min(1).max(100),
  last_name:      z.string().min(1).max(100),
  phone:          z.string().regex(/^\+?[0-9]{7,15}$/).optional(),
  dob:            isoDate.optional(),
  joining_date:   isoDate.optional(),
  qualifications: z.array(qualificationSchema).optional().default([]),
  employee_no:    z.string().max(20).optional(),
  department:     z.string().max(100).optional(),
  designation:    z.string().max(100).optional(),
  salary:         z.number().min(0).optional(),
  pay_frequency:  z.enum(['monthly', 'weekly']).optional().default('monthly'),
  bank_account:   z.string().max(20).optional(),
  bank_ifsc:      z.string().max(11).optional(),
  pan_no:         z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
  aadhar_no:      z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),
  address:        z.string().max(500).optional(),
  emergency_contact: emergencyContactSchema.optional(),
});

export const updateStaffSchema = createStaffSchema.omit({ email: true, password: true }).partial();

export const requestLeaveSchema = z.object({
  leave_type:  z.enum(['casual','sick','earned','maternity','paternity','lwp','other']),
  from_date:   isoDate,
  to_date:     isoDate,
  reason:      z.string().min(1).max(500),
}).refine(d => d.to_date >= d.from_date, {
  message: 'to_date must be on or after from_date', path: ['to_date'],
});

export const reviewLeaveSchema = z.object({
  status:      z.enum(['approved', 'rejected']),
  review_note: z.string().max(500).optional(),
});

export const createShiftSchema = z.object({
  staff_id:   z.string().uuid(),
  date:       isoDate,
  shift_type: z.enum(['morning','afternoon','full_day','split']),
  start_time: timeHHMM,
  end_time:   timeHHMM,
  notes:      z.string().max(300).optional(),
}).refine(d => d.end_time > d.start_time, {
  message: 'end_time must be after start_time', path: ['end_time'],
});

export const staffFiltersSchema = z.object({
  role:      z.enum(['owner','principal','teacher','assistant_teacher','accountant','driver','support','admission_staff']).optional(),
  is_active: z.preprocess(v => v === 'false' ? false : v === 'true' ? true : v, z.boolean()).optional(),
  search:    z.string().max(100).optional(),
  page:      z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:     z.preprocess(Number, z.number().int().min(1).max(100)).optional().default(20),
});

export const leaveFiltersSchema = z.object({
  staff_id:   z.string().uuid().optional(),
  status:     z.enum(['pending','approved','rejected','cancelled']).optional(),
  leave_type: z.enum(['casual','sick','earned','maternity','paternity','lwp','other']).optional(),
  from:       isoDate.optional(),
  to:         isoDate.optional(),
  page:       z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:      z.preprocess(Number, z.number().int().min(1).max(100)).optional().default(20),
});

export const payrollFiltersSchema = z.object({
  month: z.preprocess(Number, z.number().int().min(1).max(12)),
  year:  z.preprocess(Number, z.number().int().min(2020).max(2099)),
  role:  z.enum(['owner','principal','teacher','assistant_teacher','accountant','driver','support','admission_staff']).optional(),
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

export const validateCreateStaff    = validateBody(createStaffSchema);
export const validateUpdateStaff    = validateBody(updateStaffSchema);
export const validateRequestLeave   = validateBody(requestLeaveSchema);
export const validateReviewLeave    = validateBody(reviewLeaveSchema);
export const validateCreateShift    = validateBody(createShiftSchema);
export const validateStaffFilters   = validateQuery(staffFiltersSchema);
export const validateLeaveFilters   = validateQuery(leaveFiltersSchema);
export const validatePayrollFilters = validateQuery(payrollFiltersSchema);
