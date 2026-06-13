import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  getDashboard, getAttendanceTrend, getFeeCollection,
  getStaffDashboard, getLeaveOverview,
} from './analytics.controller.js';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);

const ADMIN_ROLES = ['owner', 'principal', 'accountant'];

analyticsRouter.get('/staff-dashboard', getStaffDashboard);
analyticsRouter.get('/leave-overview',   authorize(...ADMIN_ROLES), getLeaveOverview);
analyticsRouter.get('/dashboard',          authorize(...ADMIN_ROLES), getDashboard);
analyticsRouter.get('/attendance-trend',   authorize(...ADMIN_ROLES), getAttendanceTrend);
analyticsRouter.get('/fee-collection',     authorize(...ADMIN_ROLES), getFeeCollection);
