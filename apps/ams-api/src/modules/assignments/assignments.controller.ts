import { Request, Response } from 'express';
import { assignmentsService } from './assignments.service.js';
import type { CreateAssignmentDto, AssignmentFilters } from './assignments.types.js';

export async function listAssignments(req: Request, res: Response): Promise<void> {
  const rows = await assignmentsService.list(req.user!.tenantSchema, req.query as AssignmentFilters);
  res.json({ data: rows });
}

export async function createAssignment(req: Request, res: Response): Promise<void> {
  const row = await assignmentsService.create(req.user!.tenantSchema, req.body as CreateAssignmentDto, req.user!.sub);
  res.status(201).json({ data: row, message: 'Assignment created' });
}

export async function deleteAssignment(req: Request, res: Response): Promise<void> {
  await assignmentsService.delete(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ message: 'Assignment removed' });
}
