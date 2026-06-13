import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateTemplate, validateUpdateTemplate, validateAssignTemplate,
} from './template.validators.js';
import {
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  assignTemplateToClass, unassignTemplateFromClass,
  getProgressCard,
} from './reports.controller.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

const ADMIN_ROLES = ['owner', 'principal'];
const VIEW_ROLES  = ['owner', 'principal', 'teacher', 'assistant_teacher', 'parent'];

// ── Templates ─────────────────────────────────────────────────────────────────
reportsRouter.get(   '/templates',                      authorize(...ADMIN_ROLES), listTemplates);
reportsRouter.post(  '/templates',                      authorize(...ADMIN_ROLES), validateCreateTemplate, createTemplate);
reportsRouter.get(   '/templates/:id',                  authorize(...ADMIN_ROLES), getTemplate);
reportsRouter.put(   '/templates/:id',                  authorize(...ADMIN_ROLES), validateUpdateTemplate, updateTemplate);
reportsRouter.delete('/templates/:id',                  authorize(...ADMIN_ROLES), deleteTemplate);

// ── Class template assignment ──────────────────────────────────────────────────
reportsRouter.post(  '/templates/assign/class/:classId', authorize(...ADMIN_ROLES), validateAssignTemplate, assignTemplateToClass);
reportsRouter.delete('/templates/assign/class/:classId', authorize(...ADMIN_ROLES), unassignTemplateFromClass);

// ── PDF generation ─────────────────────────────────────────────────────────────
reportsRouter.get('/progress-card/:studentId', authorize(...VIEW_ROLES), getProgressCard);
