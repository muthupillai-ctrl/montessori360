import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth.js';

/**
 * Combines JWT authentication with tenant schema resolution.
 * All routes mounted after this middleware have req.user.tenantSchema available.
 *
 * The tenant schema name is embedded in the JWT at login time so we avoid
 * a DB lookup on every request.
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  authenticate(req, res, (err?: unknown) => {
    if (err) return next(err);
    // tenantSchema validated inside authenticate via JWT signature
    next();
  });
}
