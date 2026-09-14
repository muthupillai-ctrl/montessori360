import type { Request, Response } from 'express';
import * as svc from './curriculum.service.js';
import { AppError } from '../../middleware/errorHandler.js';

// ── Areas ──────────────────────────────────────────────────────────────────

export async function listAreas(req: Request, res: Response) {
  const areas = await svc.listAreas(req.user!.tenantSchema);
  res.json(areas);
}

export async function createArea(req: Request, res: Response) {
  const area = await svc.createArea(req.user!.tenantSchema, req.body);
  res.status(201).json(area);
}

export async function updateArea(req: Request, res: Response) {
  const area = await svc.updateArea(req.user!.tenantSchema, req.params['id'] as string, req.body);
  if (!area) throw new AppError(404, 'Area not found');
  res.json(area);
}

export async function deleteArea(req: Request, res: Response) {
  const deleted = await svc.deleteArea(req.user!.tenantSchema, req.params['id'] as string);
  if (!deleted) throw new AppError(404, 'Area not found');
  res.status(204).end();
}

// ── Activities ─────────────────────────────────────────────────────────────

export async function listActivities(req: Request, res: Response) {
  const activities = await svc.listActivities(req.user!.tenantSchema, req.params['areaId'] as string);
  res.json(activities);
}

export async function createActivity(req: Request, res: Response) {
  const activity = await svc.createActivity(req.user!.tenantSchema, req.params['areaId'] as string, req.body);
  res.status(201).json(activity);
}

export async function updateActivity(req: Request, res: Response) {
  const activity = await svc.updateActivity(req.user!.tenantSchema, req.params['activityId'] as string, req.body);
  if (!activity) throw new AppError(404, 'Activity not found');
  res.json(activity);
}

export async function deleteActivity(req: Request, res: Response) {
  const deleted = await svc.deleteActivity(req.user!.tenantSchema, req.params['activityId'] as string);
  if (!deleted) throw new AppError(404, 'Activity not found');
  res.status(204).end();
}

// ── Progress ───────────────────────────────────────────────────────────────

export async function getStudentProgress(req: Request, res: Response) {
  const progress = await svc.getStudentProgress(req.user!.tenantSchema, req.params['studentId'] as string);
  res.json(progress);
}

export async function upsertProgress(req: Request, res: Response) {
  const progress = await svc.upsertProgress(
    req.user!.tenantSchema,
    req.params['studentId'] as string,
    req.params['activityId'] as string,
    req.body,
    req.user!.sub,
  );
  res.json(progress);
}

// ── Progress Report ────────────────────────────────────────────────────────

export async function getProgressReport(req: Request, res: Response) {
  const html = await svc.getProgressReport(req.user!.tenantSchema, req.params['studentId'] as string);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}

// ── Seed ───────────────────────────────────────────────────────────────────

export async function seedCurriculum(req: Request, res: Response) {
  const result = await svc.seedCurriculum(req.user!.tenantSchema);
  if (result.areas === 0) {
    res.json({ message: 'Curriculum already seeded', seeded: false });
  } else {
    res.status(201).json({
      message: `Seeded ${result.areas} areas and ${result.activities} activities`,
      seeded: true,
      ...result,
    });
  }
}
