import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateCreate, validateUpdate, validateGenerate } from './question-papers.validators.js';
import {
  listQuestionPapers, getQuestionPaper, createQuestionPaper, updateQuestionPaper,
  deleteQuestionPaper, generateQuestionPaper,
} from './question-papers.controller.js';

export const questionPapersRouter = Router();

questionPapersRouter.use(authenticate);

questionPapersRouter.get('/',          listQuestionPapers);
questionPapersRouter.get('/:id',       getQuestionPaper);
questionPapersRouter.post('/',         authorize('owner', 'principal', 'teacher'), validateCreate,   createQuestionPaper);
questionPapersRouter.post('/generate', authorize('owner', 'principal', 'teacher'), validateGenerate, generateQuestionPaper);
questionPapersRouter.patch('/:id',     authorize('owner', 'principal', 'teacher'), validateUpdate,   updateQuestionPaper);
questionPapersRouter.delete('/:id',    authorize('owner', 'principal'),            deleteQuestionPaper);
