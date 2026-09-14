import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  listAreas, createArea, updateArea, deleteArea,
  listActivities, createActivity, updateActivity, deleteActivity,
  getStudentProgress, upsertProgress, getProgressReport, seedCurriculum,
} from './curriculum.controller.js';
import {
  validateCreateArea, validateUpdateArea,
  validateCreateActivity, validateUpdateActivity,
  validateUpsertProgress,
} from './curriculum.validators.js';

export const curriculumRouter = Router();

curriculumRouter.use(authenticate);

// Areas
curriculumRouter.get('/areas',                listAreas);
curriculumRouter.post('/areas',               authorize('owner', 'principal', 'teacher'), validateCreateArea,  createArea);
curriculumRouter.patch('/areas/:id',          authorize('owner', 'principal', 'teacher'), validateUpdateArea,  updateArea);
curriculumRouter.delete('/areas/:id',         authorize('owner', 'principal'),            deleteArea);

// Activities nested under an area
curriculumRouter.get('/areas/:areaId/activities',                listActivities);
curriculumRouter.post('/areas/:areaId/activities',               authorize('owner', 'principal', 'teacher'), validateCreateActivity,  createActivity);
curriculumRouter.patch('/areas/:areaId/activities/:activityId',  authorize('owner', 'principal', 'teacher'), validateUpdateActivity,  updateActivity);
curriculumRouter.delete('/areas/:areaId/activities/:activityId', authorize('owner', 'principal'),            deleteActivity);

// Per-student progress
curriculumRouter.get('/progress/:studentId',                 getStudentProgress);
curriculumRouter.get('/progress/:studentId/report',          getProgressReport);
curriculumRouter.put('/progress/:studentId/:activityId',     authorize('owner', 'principal', 'teacher'), validateUpsertProgress, upsertProgress);

// Seed default Montessori curriculum (no-op if already seeded)
curriculumRouter.post('/seed', authorize('owner', 'principal'), seedCurriculum);
