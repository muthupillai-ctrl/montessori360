import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const attendanceModeSchema   = z.enum(['qr', 'biometric', 'manual']).optional().default('manual');
const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'half_day', 'holiday']);
const isoDateSchema          = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ── Schemas ───────────────────────────────────────────────────────────────────

export const checkInSchema = z.object({
  student_id:    z.string().uuid('Invalid student ID'),
  date:          isoDateSchema.optional(),
  status:        attendanceStatusSchema.optional().default('present'),
  mode:          attendanceModeSchema,
  check_in_time: z.string().optional(),
  notes:         z.string().max(500).optional(),
});

export const checkOutSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  notes:      z.string().max(500).optional(),
});

export const bulkMarkSchema = z.object({
  date: isoDateSchema.optional(),
  records: z.array(z.object({
    student_id: z.string().uuid(),
    status:     attendanceStatusSchema,
    notes:      z.string().max(500).optional(),
  })).min(1, 'At least one record required'),
});

export const attendanceFiltersSchema = z.object({
  date:       isoDateSchema.optional(),
  class_id:   z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  status:     attendanceStatusSchema.optional(),
  page:       z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:      z.preprocess(Number, z.number().int().min(1).max(100)).optional().default(20),
});

export const monthlyReportSchema = z.object({
  year:       z.preprocess(Number, z.number().int().min(2020).max(2099)),
  month:      z.preprocess(Number, z.number().int().min(1).max(12)),
  class_id:   z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
});

// ── Middleware factory ────────────────────────────────────────────────────────

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

export const validateCheckIn       = validateBody(checkInSchema);
export const validateCheckOut      = validateBody(checkOutSchema);
export const validateBulkMark      = validateBody(bulkMarkSchema);
export const validateAttendanceFilters = validateQuery(attendanceFiltersSchema);
export const validateMonthlyReport = validateQuery(monthlyReportSchema);
