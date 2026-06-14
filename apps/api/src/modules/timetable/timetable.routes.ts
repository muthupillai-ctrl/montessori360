import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  listSubjects, createSubject, updateSubject,
  listTemplates, getTemplate, createTemplate, updateTemplate,
  listTimetables, getTimetable, createTimetable, updateTimetable,
  upsertSlot, clearSlot, getTeacherSchedule,
  getClassSubjectTeachers, upsertClassSubjectTeacher, getSubjectTeacherLookup,
} from './timetable.controller.js';

export const timetableRouter = Router();
timetableRouter.use(authenticate);

const ADMIN      = ['owner', 'principal'];
const ALL_STAFF  = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'admission_staff', 'driver', 'support'];

// ── Subjects ──────────────────────────────────────────────────────────────────
timetableRouter.get(  '/subjects',     authorize(...ALL_STAFF), listSubjects);
timetableRouter.post( '/subjects',     authorize(...ADMIN),     createSubject);
timetableRouter.put(  '/subjects/:id', authorize(...ADMIN),     updateSubject);

// ── Period Templates ──────────────────────────────────────────────────────────
timetableRouter.get(  '/templates',     authorize(...ALL_STAFF), listTemplates);
timetableRouter.get(  '/templates/:id', authorize(...ALL_STAFF), getTemplate);
timetableRouter.post( '/templates',     authorize(...ADMIN),     createTemplate);
timetableRouter.put(  '/templates/:id', authorize(...ADMIN),     updateTemplate);

// ── Class subject teacher mapping ─────────────────────────────────────────────
timetableRouter.get( '/subject-teacher-lookup',     authorize(...ALL_STAFF), getSubjectTeacherLookup);
timetableRouter.get( '/class/:classId/subjects',    authorize(...ALL_STAFF), getClassSubjectTeachers);
timetableRouter.post('/class/:classId/subjects',    authorize(...ADMIN),     upsertClassSubjectTeacher);

// ── Timetables ────────────────────────────────────────────────────────────────
timetableRouter.get(  '/',            authorize(...ALL_STAFF), listTimetables);
timetableRouter.get(  '/:id',         authorize(...ALL_STAFF), getTimetable);
timetableRouter.post( '/',            authorize(...ADMIN),     createTimetable);
timetableRouter.put(  '/:id',         authorize(...ADMIN),     updateTimetable);
timetableRouter.post( '/:id/slots',   authorize(...ADMIN),     upsertSlot);
timetableRouter.delete('/:id/slots',  authorize(...ADMIN),     clearSlot);

// ── Teacher schedule ──────────────────────────────────────────────────────────
timetableRouter.get('/teacher/:teacherId/schedule', authorize(...ALL_STAFF), getTeacherSchedule);
