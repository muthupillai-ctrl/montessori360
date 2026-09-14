import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { integrationService } from '../modules/integration/integration.service.js';

export interface JwtPayload {
  sub: string;           // user UUID
  tenantId: string;      // school UUID
  tenantSchema: string;  // PostgreSQL schema name e.g. "tenant_abc123"
  role: string;
  email: string;
  iat: number;
  exp: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      parsedQuery?: Record<string, unknown>;
      apiKeyAuth?: boolean;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Token expired');
    }
    throw AppError.unauthorized('Invalid token');
  }
}

// For external app-to-app calls using X-Api-Key header
export function authenticateApiKey(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) throw AppError.unauthorized('Missing X-Api-Key header');

  integrationService.validateKey(apiKey).then(result => {
    if (!result) throw AppError.unauthorized('Invalid or revoked API key');
    req.user = {
      sub: 'api-key', tenantId: '', tenantSchema: result.tenantSchema,
      role: 'api_key', email: '', iat: 0, exp: 0,
    };
    req.apiKeyAuth = true;
    next();
  }).catch(next);
}

/**
 * Role-based access guard. Use after authenticate().
 * Example: router.get('/report', authenticate, authorize('principal', 'owner'), handler)
 */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden(`Role '${req.user.role}' is not allowed to access this resource`);
    }
    next();
  };
}
