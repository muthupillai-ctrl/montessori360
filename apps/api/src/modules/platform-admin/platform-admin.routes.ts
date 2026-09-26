import { Router } from 'express';
import { authenticatePlatformAdmin } from './platform-admin.middleware.js';
import {
  validateLogin, validateCreateTenant, validateUpdateTenant, validateResetStaffPassword,
  validateCreateOwner, validateUpdateOwner, validateCreatePlan, validateUpdatePlan, validateUpdateSubscription,
} from './platform-admin.validators.js';
import {
  login, listTenants, getTenant, createTenant, updateTenant, toggleActive, listPlans, getAiUsage,
  listSchoolAdmins, resetStaffPassword, listOwners, createOwner, updateOwner, deleteOwner,
  listAllPlans, createPlan, updatePlan, archivePlan, deletePlan, updateSubscription,
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
platformAdminRouter.get('/ai-usage',                    getAiUsage);
platformAdminRouter.get('/tenants/:id/admins',          listSchoolAdmins);
platformAdminRouter.get('/plans/all',                     listAllPlans);
platformAdminRouter.post('/plans',                        validateCreatePlan, createPlan);
platformAdminRouter.put('/plans/:id',                     validateUpdatePlan, updatePlan);
platformAdminRouter.patch('/plans/:id/archive',           archivePlan);
platformAdminRouter.delete('/plans/:id',                  deletePlan);
platformAdminRouter.put('/tenants/:id/subscription',      validateUpdateSubscription, updateSubscription);
platformAdminRouter.get('/tenants/:id/owners',                 listOwners);
platformAdminRouter.post('/tenants/:id/owners',                validateCreateOwner, createOwner);
platformAdminRouter.put('/tenants/:id/owners/:staffId',        validateUpdateOwner, updateOwner);
platformAdminRouter.delete('/tenants/:id/owners/:staffId',     deleteOwner);
platformAdminRouter.post('/tenants/:id/staff/:staffId/reset-password', validateResetStaffPassword, resetStaffPassword);
