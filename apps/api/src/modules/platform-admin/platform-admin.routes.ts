import { Router } from 'express';
import { authenticatePlatformAdmin } from './platform-admin.middleware.js';
import { validateLogin, validateCreateTenant, validateUpdateTenant } from './platform-admin.validators.js';
import {
  login, listTenants, getTenant, createTenant, updateTenant, toggleActive, listPlans,
} from './platform-admin.controller.js';

export const platformAdminRouter = Router();

// ── Public ─────────────────────────────────────────────────────────────────────
platformAdminRouter.post('/auth/login', validateLogin, login);
platformAdminRouter.get('/plans', listPlans);

// ── Protected (platform admin only) ───────────────────────────────────────────
platformAdminRouter.use(authenticatePlatformAdmin);
platformAdminRouter.get('/tenants',             listTenants);
platformAdminRouter.post('/tenants',            validateCreateTenant, createTenant);
platformAdminRouter.get('/tenants/:id',         getTenant);
platformAdminRouter.put('/tenants/:id',         validateUpdateTenant, updateTenant);
platformAdminRouter.patch('/tenants/:id/toggle-active', toggleActive);
