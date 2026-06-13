import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const audienceSchema = z.enum(['all', 'staff', 'parents', 'class']);

const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  url:  z.string().url(),
  type: z.string().min(1),
  size: z.number().optional(),
});

// ── Schemas ───────────────────────────────────────────────────────────────────

export const createAnnouncementSchema = z.object({
  title:       z.string().min(1).max(255),
  body:        z.string().min(1),
  audience:    audienceSchema,
  class_ids:   z.array(z.string().uuid()).optional().default([]),
  attachments: z.array(attachmentSchema).optional().default([]),
  publish_now: z.boolean().optional().default(true),
  expires_at:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (d) => d.audience !== 'class' || (d.class_ids && d.class_ids.length > 0),
  { message: 'class_ids required when audience is "class"', path: ['class_ids'] }
);

export const createCircularSchema = z.object({
  title:        z.string().min(1).max(255),
  body:         z.string().min(1),
  audience:     audienceSchema,
  class_ids:    z.array(z.string().uuid()).optional().default([]),
  attachments:  z.array(attachmentSchema).optional().default([]),
  requires_ack: z.boolean().optional().default(true),
  publish_now:  z.boolean().optional().default(true),
  expires_at:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const sendMessageSchema = z.object({
  recipient_id:   z.string().uuid('Invalid recipient ID'),
  recipient_type: z.enum(['staff', 'parent']),
  body:           z.string().min(1).max(2000),
  attachments:    z.array(attachmentSchema).optional().default([]),
});

export const announcementFiltersSchema = z.object({
  audience:  audienceSchema.optional(),
  class_id:  z.string().uuid().optional(),
  published: z.preprocess((v) => v === 'true' ? true : v === 'false' ? false : v, z.boolean()).optional(),
  page:      z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:     z.preprocess(Number, z.number().int().min(1).max(100)).optional().default(20),
});

export const messageFiltersSchema = z.object({
  partner_id:   z.string().uuid().optional(),
  partner_type: z.enum(['staff', 'parent']).optional(),
  unread_only:  z.preprocess((v) => v === 'true', z.boolean()).optional().default(false),
  page:         z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:        z.preprocess(Number, z.number().int().min(1).max(50)).optional().default(20),
});

// ── Middleware factories ───────────────────────────────────────────────────────

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

export const validateCreateAnnouncement = validateBody(createAnnouncementSchema);
export const validateCreateCircular     = validateBody(createCircularSchema);
export const validateSendMessage        = validateBody(sendMessageSchema);
export const validateAnnouncementFilters = validateQuery(announcementFiltersSchema);
export const validateMessageFilters     = validateQuery(messageFiltersSchema);
