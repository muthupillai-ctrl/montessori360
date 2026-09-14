import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateCreate } from './assignments.validators.js';
import { listAssignments, createAssignment, deleteAssignment } from './assignments.controller.js';

export const assignmentsRouter = Router();

assignmentsRouter.use(authenticate);

assignmentsRouter.get('/',       listAssignments);
assignmentsRouter.post('/',      authorize('owner', 'principal', 'teacher'), validateCreate, createAssignment);
assignmentsRouter.delete('/:id', authorize('owner', 'principal', 'teacher'), deleteAssignment);
