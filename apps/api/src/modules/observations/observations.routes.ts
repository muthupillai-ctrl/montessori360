import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateDomain, validateCreateMilestone,
  validateRecordObservation, validateBulkObservation, validateObservationFilters,
} from './observations.validators.js';
import {
  listDomains, createDomain,
  listMilestones, createMilestone, updateMilestone, deleteMilestone,
  listObservations, recordObservation, bulkRecordObservations,
  getStudentProgress,
} from './observations.controller.js';

export const observationsRouter = Router();
observationsRouter.use(authenticate);

const TEACHER_ROLES = ['owner', 'principal', 'teacher', 'assistant_teacher'];
const VIEW_ROLES    = ['owner', 'principal', 'teacher', 'assistant_teacher', 'parent'];
const ADMIN_ROLES   = ['owner', 'principal'];

// ── Domains ───────────────────────────────────────────────────────────────────
observationsRouter.get( '/domains',       authorize(...VIEW_ROLES),    listDomains);
observationsRouter.post('/domains',       authorize(...ADMIN_ROLES),   validateCreateDomain, createDomain);

// ── Milestones ────────────────────────────────────────────────────────────────
observationsRouter.get( '/milestones',    authorize(...VIEW_ROLES),    listMilestones);
observationsRouter.post('/milestones',        authorize(...ADMIN_ROLES), validateCreateMilestone, createMilestone);
observationsRouter.put('/milestones/:id',    authorize(...ADMIN_ROLES), updateMilestone);
observationsRouter.delete('/milestones/:id', authorize(...ADMIN_ROLES), deleteMilestone);

// ── Observations ──────────────────────────────────────────────────────────────
observationsRouter.get( '/',             authorize(...VIEW_ROLES),    validateObservationFilters, listObservations);
observationsRouter.post('/',             authorize(...TEACHER_ROLES), validateRecordObservation,  recordObservation);
observationsRouter.post('/bulk',         authorize(...TEACHER_ROLES), validateBulkObservation,    bulkRecordObservations);

// ── Progress ──────────────────────────────────────────────────────────────────
observationsRouter.get('/progress/:studentId', authorize(...VIEW_ROLES), getStudentProgress);
