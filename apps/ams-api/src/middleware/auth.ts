import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { provisionTenant } from '../config/database.js';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSchema: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('Missing or invalid Authorization header');

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env['JWT_ACCESS_SECRET']!) as JwtPayload;
    req.user = payload;
    // Auto-provision tenant schema on first access (fire-and-forget after check)
    provisionTenant(payload.tenantSchema).then(() => next()).catch(next);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw AppError.unauthorized('Token expired');
    throw AppError.unauthorized('Invalid token');
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden(`Role '${req.user.role}' cannot access this resource`);
    next();
  };
}
