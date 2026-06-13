import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateJournal, validateUpdateJournal, validateJournalFilters,
} from './journal.validators.js';
import {
  listJournals, getJournal, getStudentJournalByDate,
  createJournal, updateJournal, publishJournal,
  bulkPublishJournals, getClassOverview,
  getMoodTrend, getSchoolMoodSummary, getCompletionReport, getWeeklyDigest,
} from './journal.controller.js';

export const journalRouter = Router();
journalRouter.use(authenticate);

const TEACHER_ROLES = ['owner', 'principal', 'teacher', 'assistant_teacher'];
const VIEW_ROLES    = ['owner', 'principal', 'teacher', 'assistant_teacher', 'parent'];

// Reports
journalRouter.get('/reports/completion',    authorize(...TEACHER_ROLES), getCompletionReport);
journalRouter.get('/reports/mood-summary',  authorize(...TEACHER_ROLES), getSchoolMoodSummary);
journalRouter.get('/students/:studentId/mood-trend',    authorize(...VIEW_ROLES), getMoodTrend);
journalRouter.get('/students/:studentId/weekly-digest', authorize(...VIEW_ROLES), getWeeklyDigest);

// Class overview (how many journals done today per class)
journalRouter.get('/classes/:classId/overview',
  authorize(...TEACHER_ROLES),
  getClassOverview
);

// Bulk publish all journals for a class
journalRouter.post('/bulk-publish',
  authorize(...TEACHER_ROLES),
  bulkPublishJournals
);

// Student journal by date (parent-friendly URL)
journalRouter.get('/students/:studentId/:date',
  authorize(...VIEW_ROLES),
  getStudentJournalByDate
);

// CRUD
journalRouter.get('/',
  authorize(...VIEW_ROLES),
  validateJournalFilters,
  listJournals
);

journalRouter.post('/',
  authorize(...TEACHER_ROLES),
  validateCreateJournal,
  createJournal
);

journalRouter.get('/:id',
  authorize(...VIEW_ROLES),
  getJournal
);

journalRouter.put('/:id',
  authorize(...TEACHER_ROLES),
  validateUpdateJournal,
  updateJournal
);

journalRouter.patch('/:id/publish',
  authorize(...TEACHER_ROLES),
  publishJournal
);
