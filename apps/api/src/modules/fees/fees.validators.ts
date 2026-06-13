import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const feeHeadSchema = z.object({
  name:        z.string().min(1).max(100),
  amount:      z.number().min(0),
  is_optional: z.boolean().default(false),
  description: z.string().max(255).optional(),
});

const lineItemSchema = z.object({
  name:        z.string().min(1).max(100),
  amount:      z.number().min(0),
  description: z.string().max(255).optional(),
});

// ── Main schemas ──────────────────────────────────────────────────────────────

export const createFeeStructureSchema = z.object({
  name:          z.string().min(1).max(255),
  academic_year: z.string().regex(/^\d{4}-\d{4}$/, 'Format must be YYYY-YYYY e.g. 2025-2026'),
  billing_cycle: z.enum(['monthly', 'quarterly', 'half_yearly', 'annually', 'one_time']),
  heads:         z.array(feeHeadSchema).min(1, 'At least one fee head required'),
  applies_to:    z.enum(['all', 'class']).default('all'),
  class_ids:     z.array(z.string().uuid()).optional().default([]),
});

export const createInvoiceSchema = z.object({
  student_id:        z.string().uuid(),
  fee_structure_id:  z.string().uuid().optional(),
  billing_period:    z.string().min(1).max(30),
  line_items:        z.array(lineItemSchema).min(1),
  discount:          z.number().min(0).default(0),
  tax:               z.number().min(0).default(0),
  due_date:          isoDateSchema,
});

export const bulkCreateInvoicesSchema = z.object({
  fee_structure_id: z.string().uuid(),
  billing_period:   z.string().min(1).max(30),
  due_date:         isoDateSchema,
  class_id:         z.string().uuid().optional(),
  discount:         z.number().min(0).default(0),
});

export const recordPaymentSchema = z.object({
  amount:               z.number().positive('Payment amount must be greater than 0'),
  method:               z.enum(['razorpay', 'cash', 'bank_transfer', 'cheque']),
  reference_no:         z.string().max(100).optional(),
  razorpay_payment_id:  z.string().max(100).optional(),
  notes:                z.string().max(500).optional(),
});

export const waiveInvoiceSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const invoiceFiltersSchema = z.object({
  student_id:     z.string().uuid().optional(),
  class_id:       z.string().uuid().optional(),
  status:         z.enum(['pending', 'paid', 'partial', 'overdue', 'waived']).optional(),
  due_date_from:  isoDateSchema.optional(),
  due_date_to:    isoDateSchema.optional(),
  billing_period: z.string().optional(),
  page:           z.preprocess(Number, z.number().int().min(1)).optional().default(1),
  limit:          z.preprocess(Number, z.number().int().min(1).max(100)).optional().default(20),
});

export const defaulterFiltersSchema = z.object({
  class_id:     z.string().uuid().optional(),
  overdue_days: z.preprocess(Number, z.number().int().min(0)).optional().default(0),
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

export const validateCreateFeeStructure  = validateBody(createFeeStructureSchema);
export const validateCreateInvoice       = validateBody(createInvoiceSchema);
export const validateBulkCreateInvoices  = validateBody(bulkCreateInvoicesSchema);
export const validateRecordPayment       = validateBody(recordPaymentSchema);
export const validateWaiveInvoice        = validateBody(waiveInvoiceSchema);
export const validateInvoiceFilters      = validateQuery(invoiceFiltersSchema);
export const validateDefaulterFilters    = validateQuery(defaulterFiltersSchema);
