import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const isoDate   = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeHHMM  = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM');
const hexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#2E5AA8');
const dayOfWeek = z.number().int().min(0).max(6);

const eventTypeSchema = z.enum([
  'holiday', 'exam', 'event', 'meeting', 'excursion', 'closure', 'term_start', 'term_end', 'other',
]);

// ── Schemas ───────────────────────────────────────────────────────────────────

export const createAcademicYearSchema = z.object({
  name:         z.string().min(1).max(20),
  start_date:   isoDate,
  end_date:     isoDate,
  working_days: z.array(dayOfWeek).optional().default([1, 2, 3, 4, 5]),
  is_current:   z.boolean().optional().default(false),
}).refine(d => d.end_date > d.start_date, {
  message: 'end_date must be after start_date', path: ['end_date'],
});

export const createTermSchema = z.object({
  academic_year_id: z.string().uuid(),
  name:             z.string().min(1).max(50),
  start_date:       isoDate,
  end_date:         isoDate,
  sort_order:       z.number().int().min(1).optional().default(1),
}).refine(d => d.end_date > d.start_date, {
  message: 'end_date must be after start_date', path: ['end_date'],
});

export const createEventSchema = z.object({
  title:              z.string().min(1).max(255),
  description:        z.string().max(1000).optional(),
  event_type:         eventTypeSchema,
  start_date:         isoDate,
  end_date:           isoDate,
  is_all_day:         z.boolean().optional().default(true),
  start_time:         timeHHMM.optional(),
  end_time:           timeHHMM.optional(),
  affects_attendance: z.boolean().optional().default(false),
  class_ids:          z.array(z.string().uuid()).optional().default([]),
  recurrence:         z.enum(['none', 'weekly', 'monthly', 'yearly']).optional().default('none'),
  colour:             hexColour,
});

export const createTimetableSlotSchema = z.object({
  class_id:    z.string().uuid(),
  day_of_week: dayOfWeek,
  start_time:  timeHHMM,
  end_time:    timeHHMM,
  subject:     z.string().min(1).max(100),
  teacher_id:  z.string().uuid().optional(),
  room:        z.string().max(50).optional(),
}).refine(d => d.end_time > d.start_time, {
  message: 'end_time must be after start_time', path: ['end_time'],
});

export const calendarFiltersSchema = z.object({
  from:             isoDate.optional(),
  to:               isoDate.optional(),
  event_type:       eventTypeSchema.optional(),
  class_id:         z.string().uuid().optional(),
  academic_year_id: z.string().uuid().optional(),
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

export const validateCreateAcademicYear  = validateBody(createAcademicYearSchema);
export const validateCreateTerm          = validateBody(createTermSchema);
export const validateCreateEvent         = validateBody(createEventSchema);
export const validateCreateTimetableSlot = validateBody(createTimetableSlotSchema);
export const validateCalendarFilters     = validateQuery(calendarFiltersSchema);
