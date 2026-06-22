import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCheckIn, validateCheckOut, validateBulkMark,
  validateAttendanceFilters, validateMonthlyReport,
} from './attendance.validators.js';
import {
  checkIn, checkOut, bulkMark,
  getDailySummary, listAttendance, getMonthlyReport,
  getRoster, quickMark,
} from './attendance.controller.js';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

const MARK_ROLES = ['owner', 'principal', 'teacher', 'assistant_teacher', 'rfid_admin'];
const VIEW_ROLES = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant'];

// Mark attendance
attendanceRouter.post('/check-in',       authorize(...MARK_ROLES), validateCheckIn,           checkIn);
attendanceRouter.post('/check-out',      authorize(...MARK_ROLES), validateCheckOut,          checkOut);
attendanceRouter.post('/bulk-mark',      authorize(...MARK_ROLES), validateBulkMark,          bulkMark);

// View attendance
attendanceRouter.get('/roster',         authorize(...MARK_ROLES), getRoster);
attendanceRouter.post('/quick-mark',     authorize(...MARK_ROLES), quickMark);
attendanceRouter.get('/',                authorize(...VIEW_ROLES), validateAttendanceFilters, listAttendance);
attendanceRouter.get('/daily-summary',   authorize(...VIEW_ROLES), validateAttendanceFilters, getDailySummary);
attendanceRouter.get('/monthly-report',  authorize(...VIEW_ROLES), validateMonthlyReport,     getMonthlyReport);
