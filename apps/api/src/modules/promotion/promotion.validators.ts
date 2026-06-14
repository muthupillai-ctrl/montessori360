import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler.js';

const classMappingEntry = z.object({
  from_class_id: z.string().uuid(),
  to_class_id: z.string().uuid().nullable(),
});

const prepareSchema = z.object({
  from_academic_year_id: z.string().uuid(),
  to_academic_year_id: z.string().uuid(),
  class_mapping: z.array(classMappingEntry).min(1, 'At least one class mapping required'),
});

const executeSchema = prepareSchema.extend({
  confirmed: z.literal(true),
});

function validate(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(AppError.badRequest(result.error.errors.map(e => e.message).join(', ')));
    }
    req.body = result.data;
    next();
  };
}

export const validatePrepare = validate(prepareSchema);
export const validateExecute = validate(executeSchema);
