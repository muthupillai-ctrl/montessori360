import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const createSchema = z.object({
  content_type:  z.enum(['worksheet', 'lesson_plan', 'question_paper', 'curriculum_area']),
  content_id:    z.string().uuid(),
  content_title: z.string().min(1).max(255),
  class_id:      z.string().uuid().optional(),
  class_name:    z.string().max(255).optional(),
  student_id:    z.string().uuid().optional(),
  student_name:  z.string().max(255).optional(),
  due_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(d => d.class_id || d.student_id, { message: 'class_id or student_id is required' });

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

export const validateCreate = validate(createSchema);
