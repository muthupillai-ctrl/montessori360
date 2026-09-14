import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const LEVELS = ['montessori', 'primary', 'high_school'] as const;

const createSchema = z.object({
  title:        z.string().min(1).max(255),
  description:  z.string().max(1000).optional(),
  subject:      z.string().max(100).optional(),
  grade_level:  z.string().max(50).optional(),
  level:        z.enum(LEVELS).optional(),
  content_html: z.string().optional(),
  is_published: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

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

const generateSchema = z.object({
  subject:       z.string().min(1).max(100),
  grade_level:   z.string().min(1).max(50),
  level:         z.enum(LEVELS).optional(),
  topic:         z.string().min(1).max(255),
  activity_type: z.string().max(100).optional(),
  difficulty:    z.enum(['easy', 'medium', 'hard']).optional(),
  num_questions: z.number().int().min(1).max(30).optional(),
  title:         z.string().max(255).optional(),
  description:   z.string().max(1000).optional(),
  is_published:  z.boolean().optional(),
});

export const validateCreate   = validate(createSchema);
export const validateUpdate   = validate(updateSchema);
export const validateGenerate = validate(generateSchema);
