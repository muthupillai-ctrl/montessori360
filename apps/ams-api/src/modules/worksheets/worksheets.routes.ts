import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { uploadMiddleware } from '../../middleware/upload.js';
import { validateCreate, validateUpdate, validateGenerate } from './worksheets.validators.js';
import {
  listWorksheets, getWorksheet, createWorksheet, updateWorksheet,
  deleteWorksheet, generateWorksheet, uploadWorksheet,
} from './worksheets.controller.js';

export const worksheetsRouter = Router();

worksheetsRouter.use(authenticate);

worksheetsRouter.get('/',                                                                             listWorksheets);
worksheetsRouter.get('/:id',                                                                         getWorksheet);
worksheetsRouter.post('/',         authorize('owner', 'principal', 'teacher'), validateCreate,        createWorksheet);
worksheetsRouter.post('/generate', authorize('owner', 'principal', 'teacher'), validateGenerate,      generateWorksheet);
worksheetsRouter.post('/upload',   authorize('owner', 'principal', 'teacher'), uploadMiddleware.single('file'), uploadWorksheet);
worksheetsRouter.patch('/:id',     authorize('owner', 'principal', 'teacher'), validateUpdate,        updateWorksheet);
worksheetsRouter.delete('/:id',    authorize('owner', 'principal'),            deleteWorksheet);

