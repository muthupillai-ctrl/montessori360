import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateAcademicYear, validateCreateTerm,
  validateCreateEvent, validateCreateTimetableSlot, validateCalendarFilters,
} from './calendar.validators.js';
import {
  listAcademicYears, getCurrentYear, createAcademicYear, setCurrentYear,
  listTerms, createTerm,
  listEvents, getEvent, createEvent, updateEvent, deleteEvent, getWorkingDays,
  getTimetable, createTimetableSlot, deleteTimetableSlot, bulkReplaceTimetable,
} from './calendar.controller.js';

export const calendarRouter = Router();
calendarRouter.use(authenticate);

const ADMIN_ROLES   = ['owner', 'principal'];
const MANAGE_ROLES  = ['owner', 'principal', 'teacher'];
const VIEW_ROLES    = ['owner', 'principal', 'teacher', 'assistant_teacher', 'parent', 'accountant'];

// ── Academic Years ─────────────────────────────────────────────────────────────
calendarRouter.get( '/years',          authorize(...VIEW_ROLES),   listAcademicYears);
calendarRouter.get( '/years/current',  authorize(...VIEW_ROLES),   getCurrentYear);
calendarRouter.post('/years',          authorize(...ADMIN_ROLES),  validateCreateAcademicYear, createAcademicYear);
calendarRouter.patch('/years/:id/set-current', authorize(...ADMIN_ROLES), setCurrentYear);

// ── Terms ──────────────────────────────────────────────────────────────────────
calendarRouter.get( '/terms',          authorize(...VIEW_ROLES),   listTerms);
calendarRouter.post('/terms',          authorize(...ADMIN_ROLES),  validateCreateTerm, createTerm);

// ── Events ─────────────────────────────────────────────────────────────────────
calendarRouter.get( '/events',         authorize(...VIEW_ROLES),   validateCalendarFilters, listEvents);
calendarRouter.post('/events',         authorize(...MANAGE_ROLES), validateCreateEvent,      createEvent);
calendarRouter.get( '/events/working-days', authorize(...VIEW_ROLES), getWorkingDays);
calendarRouter.get( '/events/:id',     authorize(...VIEW_ROLES),   getEvent);
calendarRouter.put(  '/events/:id',    authorize(...MANAGE_ROLES), updateEvent);
calendarRouter.patch('/events/:id',    authorize(...MANAGE_ROLES), updateEvent);
calendarRouter.delete('/events/:id',   authorize(...ADMIN_ROLES),  deleteEvent);

// ── Timetable ──────────────────────────────────────────────────────────────────
calendarRouter.get( '/timetable/:classId',  authorize(...VIEW_ROLES),   getTimetable);
calendarRouter.post('/timetable',           authorize(...MANAGE_ROLES), validateCreateTimetableSlot, createTimetableSlot);
calendarRouter.post('/timetable/bulk',      authorize(...MANAGE_ROLES), bulkReplaceTimetable);
calendarRouter.delete('/timetable/:id',     authorize(...ADMIN_ROLES),  deleteTimetableSlot);
