import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { summaryForTenant } from './subscription.service.js';

// School-side view of its own plan: usage vs limits and soft warnings.
export const subscriptionRouter = Router();
subscriptionRouter.use(authenticate);

subscriptionRouter.get('/', authorize('owner', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await summaryForTenant(req.user!.tenantId);
    res.json({ data });
  } catch (err) { next(err); }
});
