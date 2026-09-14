import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const createSchema = z.object({
  title:                   z.string().min(1).max(255),
  subject:                 z.string().max(100).optional(),
  grade_level:             z.string().max(50).optional(),
  topic:                   z.string().max(255).optional(),
  total_marks:             z.number().int().min(1).max(1000).optional(),
  duration_minutes:        z.number().int().min(1).max(480).optional(),
  difficulty_distribution: z.string().max(255).optional(),
  question_types:          z.array(z.string()).optional(),
  content_html:            z.string().optional(),
  is_published:            z.boolean().optional(),
});

const updateSchema = createSchema.partial();

const generateSchema = z.object({
  subject:                 z.string().min(1).max(100),
  grade_level:             z.string().min(1).max(50),
  topic:                   z.string().min(1).max(255),
  total_marks:             z.number().int().min(1).max(1000).optional(),
  duration_minutes:        z.number().int().min(1).max(480).optional(),
  difficulty_distribution: z.string().max(255).optional(),
  question_types:          z.array(z.string()).optional(),
  title:                   z.string().max(255).optional(),
  is_published:            z.boolean().optional(),
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

export const validateCreate   = validate(createSchema);
export const validateUpdate   = validate(updateSchema);
export const validateGenerate = validate(generateSchema);
