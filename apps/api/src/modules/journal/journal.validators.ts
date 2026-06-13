import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const isoDate      = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const mealQty      = z.enum(['well', 'partial', 'refused']);
const activityType = z.enum([
  'free_play', 'circle_time', 'outdoor', 'art_craft',
  'music', 'story_time', 'montessori_work', 'sensorial',
  'practical_life', 'language', 'math', 'cultural', 'other',
]);

const mealSchema = z.object({
  breakfast: mealQty.optional(),
  lunch:     mealQty.optional(),
  snack:     mealQty.optional(),
  notes:     z.string().max(300).optional(),
}).optional();

const napSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM').optional(),
  end_time:   z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM').optional(),
  quality:    z.enum(['good', 'poor', 'none']).optional(),
  notes:      z.string().max(300).optional(),
}).optional();

const toiletSchema = z.object({
  count:  z.number().int().min(0),
  notes:  z.string().max(300).optional(),
}).optional();

const activityEntrySchema = z.object({
  type:          activityType,
  description:   z.string().min(1).max(500),
  duration_mins: z.number().int().min(1).max(240).optional(),
});

const homeworkEntrySchema = z.object({
  subject:     z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  completed:   z.boolean().default(false),
});

export const createJournalSchema = z.object({
  student_id:   z.string().uuid('Invalid student ID'),
  journal_date: isoDate.optional(),
  meal:         mealSchema,
  nap:          napSchema,
  toilet:       toiletSchema,
  activities:   z.array(activityEntrySchema).optional().default([]),
  mood:         z.enum(['happy', 'calm', 'unsettled', 'upset']).optional(),
  mood_note:    z.string().max(300).optional(),
  homework:     z.array(homeworkEntrySchema).optional().default([]),
  teacher_note: z.string().max(1000).optional(),
  publish:      z.boolean().optional().default(false),
});

export const updateJournalSchema = createJournalSchema
  .omit({ student_id: true, journal_date: true })
  .partial();

export const journalFiltersSchema = z.object({
  student_id:  z.string().uuid().optional(),
  class_id:    z.string().uuid().optional(),
  date:        isoDate.optional(),
  date_from:   isoDate.optional(),
  date_to:     isoDate.optional(),
  published:   z.preprocess((v) => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).optional(),
  page:        z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:       z.preprocess(Number, z.number().int().min(1).max(100)).optional().default(20),
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

export const validateCreateJournal  = validateBody(createJournalSchema);
export const validateUpdateJournal  = validateBody(updateJournalSchema);
export const validateJournalFilters = validateQuery(journalFiltersSchema);
