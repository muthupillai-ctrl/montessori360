import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validatePrepare, validateExecute } from './promotion.validators.js';
import {
  preparePromotion, executePromotion, listBatches,
  getStudentEnrollments, getClassEnrollments,
} from './promotion.controller.js';

export const promotionRouter = Router();
promotionRouter.use(authenticate);

const ADMIN_ROLES = ['owner', 'principal'];
const VIEW_ROLES  = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'admission_staff'];

// ── Bulk promotion ────────────────────────────────────────────────────────────
promotionRouter.post('/prepare',  authorize(...ADMIN_ROLES), validatePrepare, preparePromotion);
promotionRouter.post('/execute',  authorize(...ADMIN_ROLES), validateExecute, executePromotion);
promotionRouter.get( '/batches',  authorize(...ADMIN_ROLES), listBatches);

// ── Enrollment history ────────────────────────────────────────────────────────
promotionRouter.get('/students/:studentId/enrollments', authorize(...VIEW_ROLES), getStudentEnrollments);
promotionRouter.get('/classes/:classId/year/:yearId/enrollments', authorize(...VIEW_ROLES), getClassEnrollments);
