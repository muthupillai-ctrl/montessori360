import { Request, Response } from 'express';
import { lessonPlansService } from './lesson-plans.service.js';
import type { LessonPlanFilters } from './lesson-plans.types.js';

export async function listLessonPlans(req: Request, res: Response): Promise<void> {
  const rows = await lessonPlansService.list(req.user!.tenantSchema, req.query as LessonPlanFilters);
  res.json({ data: rows });
}

export async function getLessonPlan(req: Request, res: Response): Promise<void> {
  const row = await lessonPlansService.getById(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ data: row });
}

export async function createLessonPlan(req: Request, res: Response): Promise<void> {
  const row = await lessonPlansService.create(req.user!.tenantSchema, req.body, req.user!.sub);
  res.status(201).json({ data: row, message: 'Lesson plan created' });
}

export async function updateLessonPlan(req: Request, res: Response): Promise<void> {
  const row = await lessonPlansService.update(req.user!.tenantSchema, req.params['id'] as string, req.body);
  res.json({ data: row, message: 'Lesson plan updated' });
}

export async function deleteLessonPlan(req: Request, res: Response): Promise<void> {
  await lessonPlansService.delete(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ message: 'Lesson plan deleted' });
}

export async function generateLessonPlan(req: Request, res: Response): Promise<void> {
  const row = await lessonPlansService.generate(req.user!.tenantSchema, req.body, req.user!.sub);
  res.status(201).json({ data: row, message: 'Lesson plan generated' });
}
