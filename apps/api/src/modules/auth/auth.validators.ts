import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenantCode: z.string().min(3, 'Invalid school code').max(20),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  tenantCode: z.string().min(3).max(20),
});

const resetPasswordSchema = z.object({
  token: z.string().uuid('Invalid reset token'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export const validateLogin          = validate(loginSchema);
export const validateForgotPassword = validate(forgotPasswordSchema);
export const validateResetPassword  = validate(resetPasswordSchema);
