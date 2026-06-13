import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const hexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex colour e.g. #1F3864');

const sectionKeySchema = z.enum([
  'cover', 'attendance', 'mood', 'domain_progress',
  'teacher_note', 'homework_summary', 'photo_collage',
]);

const sectionConfigSchema = z.object({
  key:     sectionKeySchema,
  enabled: z.boolean(),
  order:   z.number().int().min(1).max(20),
  label:   z.string().max(50).optional(),
});

export const createTemplateSchema = z.object({
  name:              z.string().min(1).max(100),
  description:       z.string().max(500).optional(),
  logo_url:          z.string().url().optional(),
  primary_colour:    hexColour.optional().default('#1F3864'),
  secondary_colour:  hexColour.optional().default('#2E5AA8'),
  accent_colour:     hexColour.optional().default('#D6E4F0'),
  font:              z.enum(['helvetica', 'times', 'courier']).optional().default('helvetica'),
  sections:          z.array(sectionConfigSchema).optional(),
  is_default:        z.boolean().optional().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const assignTemplateSchema = z.object({
  template_id: z.string().uuid('Invalid template ID'),
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

export const validateCreateTemplate = validateBody(createTemplateSchema);
export const validateUpdateTemplate = validateBody(updateTemplateSchema);
export const validateAssignTemplate = validateBody(assignTemplateSchema);
