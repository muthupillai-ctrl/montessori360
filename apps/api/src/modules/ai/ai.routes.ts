import { Router } from 'express';
import { authorize } from '../../middleware/auth.js';
import { listInsights, insightsCount, resolveInsight, triggerInsightsRun, resolveAllInsights, remarkAssist, schoolUsage } from './ai.controller.js';

export const aiRouter = Router();

const ADMIN_ROLES    = ['owner', 'principal', 'vice_principal'] as const;
const ACADEMIC_ROLES = ['owner', 'principal', 'vice_principal', 'teacher', 'assistant_teacher'] as const;

aiRouter.get('/insights',               authorize(...ADMIN_ROLES),    listInsights);
aiRouter.get('/insights/count',         authorize(...ADMIN_ROLES),    insightsCount);
aiRouter.patch('/insights/:id/resolve', authorize(...ADMIN_ROLES),    resolveInsight);
aiRouter.post('/insights/run',          authorize(...ADMIN_ROLES),    triggerInsightsRun);
aiRouter.post('/insights/resolve-all',  authorize(...ADMIN_ROLES),    resolveAllInsights);
aiRouter.post('/assist/remark',         authorize(...ACADEMIC_ROLES), remarkAssist);
aiRouter.get('/usage',                  authorize(...ADMIN_ROLES),    schoolUsage);
