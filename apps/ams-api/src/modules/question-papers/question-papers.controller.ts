import { Request, Response } from 'express';
import { questionPapersService } from './question-papers.service.js';
import type { QuestionPaperFilters } from './question-papers.types.js';

export async function listQuestionPapers(req: Request, res: Response): Promise<void> {
  const rows = await questionPapersService.list(req.user!.tenantSchema, req.query as QuestionPaperFilters);
  res.json({ data: rows });
}

export async function getQuestionPaper(req: Request, res: Response): Promise<void> {
  const row = await questionPapersService.getById(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ data: row });
}

export async function createQuestionPaper(req: Request, res: Response): Promise<void> {
  const row = await questionPapersService.create(req.user!.tenantSchema, req.body, req.user!.sub);
  res.status(201).json({ data: row, message: 'Question paper created' });
}

export async function updateQuestionPaper(req: Request, res: Response): Promise<void> {
  const row = await questionPapersService.update(req.user!.tenantSchema, req.params['id'] as string, req.body);
  res.json({ data: row, message: 'Question paper updated' });
}

export async function deleteQuestionPaper(req: Request, res: Response): Promise<void> {
  await questionPapersService.delete(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ message: 'Question paper deleted' });
}

export async function generateQuestionPaper(req: Request, res: Response): Promise<void> {
  const row = await questionPapersService.generate(req.user!.tenantSchema, req.body, req.user!.sub);
  res.status(201).json({ data: row, message: 'Question paper generated' });
}
