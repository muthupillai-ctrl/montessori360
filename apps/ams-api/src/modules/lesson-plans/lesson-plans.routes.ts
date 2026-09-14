import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateCreate, validateUpdate, validateGenerate } from './lesson-plans.validators.js';
import {
  listLessonPlans, getLessonPlan, createLessonPlan, updateLessonPlan,
  deleteLessonPlan, generateLessonPlan,
} from './lesson-plans.controller.js';

export const lessonPlansRouter = Router();

lessonPlansRouter.use(authenticate);

lessonPlansRouter.get('/',          listLessonPlans);
lessonPlansRouter.get('/:id',       getLessonPlan);
lessonPlansRouter.post('/',         authorize('owner', 'principal', 'teacher'), validateCreate,   createLessonPlan);
lessonPlansRouter.post('/generate', authorize('owner', 'principal', 'teacher'), validateGenerate, generateLessonPlan);
lessonPlansRouter.patch('/:id',     authorize('owner', 'principal', 'teacher'), validateUpdate,   updateLessonPlan);
lessonPlansRouter.delete('/:id',    authorize('owner', 'principal'),            deleteLessonPlan);
