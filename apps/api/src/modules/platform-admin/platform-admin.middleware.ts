import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../middleware/errorHandler.js';
import type { PlatformJwtPayload } from './platform-admin.types.js';

declare global {
  namespace Express {
    interface Request {
      platformAdmin?: PlatformJwtPayload;
    }
  }
}

export function authenticatePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing Authorization header');
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as PlatformJwtPayload;
    if (payload.role !== 'platform_admin') {
      throw AppError.forbidden('Platform admin access required');
    }
    req.platformAdmin = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw AppError.unauthorized('Token expired');
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Invalid token');
  }
}
