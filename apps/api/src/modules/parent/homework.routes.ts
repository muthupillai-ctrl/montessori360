import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { homeworkService } from './homework.service.js';

export const homeworkRouter = Router();
homeworkRouter.use(authenticate);

const TEACHER_ROLES = ['owner', 'principal', 'teacher', 'assistant_teacher'];
const ADMIN_ROLES   = ['owner', 'principal'];

homeworkRouter.get('/', authorize(...TEACHER_ROLES), async (req: Request, res: Response) => {
  res.json({ data: await homeworkService.list(req.user!.tenantSchema, {
    class_id:   req.query['class_id']   as string | undefined,
    student_id: req.query['student_id'] as string | undefined,
    published:  req.query['published'] !== undefined ? req.query['published'] === 'true' : undefined,
  })});
});

homeworkRouter.post('/', authorize(...TEACHER_ROLES), async (req: Request, res: Response) => {
  res.status(201).json({ data: await homeworkService.create(req.user!.tenantSchema, req.body, req.user!.sub) });
});

homeworkRouter.patch('/:id', authorize(...TEACHER_ROLES), async (req: Request, res: Response) => {
  res.json({ data: await homeworkService.update(req.user!.tenantSchema, req.params['id'] as string, req.body) });
});

homeworkRouter.patch('/:id/publish', authorize(...TEACHER_ROLES), async (req: Request, res: Response) => {
  res.json({ data: await homeworkService.publish(req.user!.tenantSchema, req.params['id'] as string) });
});

homeworkRouter.delete('/:id', authorize(...ADMIN_ROLES), async (req: Request, res: Response) => {
  await homeworkService.delete(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ message: 'Homework task deleted' });
});
