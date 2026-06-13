import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateStaff, validateUpdateStaff, validateRequestLeave,
  validateReviewLeave, validateCreateShift,
  validateStaffFilters, validateLeaveFilters, validatePayrollFilters,
} from './staff.validators.js';
import {
  listStaff, getStaffMember, createStaffMember, updateStaffMember, deactivateStaffMember,
  getLeaveBalance, listLeaveRequests, requestLeave, reviewLeave, cancelLeave,
  listAllLeaveBalances, updateLeaveBalance, initAllLeaveBalances,
  getMyPaySlip,
  listShifts, createShift, deleteShift,
  getPayrollReport, downloadPayrollCsv,
} from './staff.controller.js';

export const staffRouter = Router();
staffRouter.use(authenticate);

const ADMIN_ROLES   = ['owner', 'principal'];
const HR_ROLES      = ['owner', 'principal', 'accountant'];
const ALL_STAFF     = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'driver', 'support'];

// ── Staff CRUD ─────────────────────────────────────────────────────────────────
staffRouter.get(   '/',          authorize(...ALL_STAFF),    validateStaffFilters, listStaff);
staffRouter.post(  '/',          authorize(...ADMIN_ROLES),  validateCreateStaff,  createStaffMember);
staffRouter.get(   '/:id',       authorize(...HR_ROLES),     getStaffMember);
staffRouter.put(   '/:id',       authorize(...ADMIN_ROLES),  validateUpdateStaff,  updateStaffMember);
staffRouter.delete('/:id',       authorize(...ADMIN_ROLES),  deactivateStaffMember);

// ── Leave ──────────────────────────────────────────────────────────────────────
// Any staff can view their own balance / request leave
staffRouter.get(  '/leave/balance/me',           authorize(...ALL_STAFF),  getLeaveBalance);
staffRouter.get(  '/leave/balances',             authorize(...ADMIN_ROLES), listAllLeaveBalances);
staffRouter.put(  '/leave/balances/:id',          authorize(...ADMIN_ROLES), updateLeaveBalance);
staffRouter.post( '/leave/balances/init',          authorize(...ADMIN_ROLES), initAllLeaveBalances);
staffRouter.get(  '/leave/balance/:staffId',     authorize(...HR_ROLES),   getLeaveBalance);
staffRouter.get(  '/leave/requests',             authorize(...ALL_STAFF),  validateLeaveFilters, listLeaveRequests);
staffRouter.post( '/leave/request',              authorize(...ALL_STAFF),  validateRequestLeave, requestLeave);
staffRouter.patch('/leave/requests/:id/review',  authorize(...ADMIN_ROLES), validateReviewLeave, reviewLeave);
staffRouter.patch('/leave/requests/:id/cancel',  authorize(...ALL_STAFF),  cancelLeave);

// ── Shifts ─────────────────────────────────────────────────────────────────────
staffRouter.get(   '/shifts',    authorize(...HR_ROLES),     listShifts);
staffRouter.post(  '/shifts',    authorize(...ADMIN_ROLES),  validateCreateShift, createShift);
staffRouter.delete('/shifts/:id', authorize(...ADMIN_ROLES), deleteShift);

// ── Payroll ────────────────────────────────────────────────────────────────────
staffRouter.get('/payroll/my-slip',  authorize(...ALL_STAFF), getMyPaySlip);
staffRouter.get('/payroll/report',   authorize(...HR_ROLES), validatePayrollFilters, getPayrollReport);
staffRouter.get('/payroll/download', authorize(...HR_ROLES), validatePayrollFilters, downloadPayrollCsv);
