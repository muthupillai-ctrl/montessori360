import { Request, Response } from 'express';
import { observationsService } from './observations.service.js';
import type {
  CreateDomainDto, CreateMilestoneDto,
  RecordObservationDto, BulkObservationDto, ObservationFilters,
} from './observations.types.js';

// ── Domains ───────────────────────────────────────────────────────────────────

export async function listDomains(req: Request, res: Response): Promise<void> {
  const rows = await observationsService.listDomains(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function createDomain(req: Request, res: Response): Promise<void> {
  const row = await observationsService.createDomain(
    req.user!.tenantSchema, req.body as CreateDomainDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Domain created successfully' });
}

// ── Milestones ────────────────────────────────────────────────────────────────

export async function listMilestones(req: Request, res: Response): Promise<void> {
  const domainId = req.query.domain_id as string | undefined;
  const rows = await observationsService.listMilestones(req.user!.tenantSchema, domainId);
  res.json({ data: rows });
}

export async function createMilestone(req: Request, res: Response): Promise<void> {
  const row = await observationsService.createMilestone(
    req.user!.tenantSchema, req.body as CreateMilestoneDto
  );
  res.status(201).json({ data: row, message: 'Milestone created successfully' });
}

// ── Observations ──────────────────────────────────────────────────────────────

export async function listObservations(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as ObservationFilters;
  const result = await observationsService.list(req.user!.tenantSchema, filters);
  res.json(result);
}

export async function recordObservation(req: Request, res: Response): Promise<void> {
  const row = await observationsService.record(
    req.user!.tenantSchema, req.body as RecordObservationDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Observation recorded' });
}

export async function bulkRecordObservations(req: Request, res: Response): Promise<void> {
  const count = await observationsService.bulkRecord(
    req.user!.tenantSchema, req.body as BulkObservationDto, req.user!.sub
  );
  res.status(201).json({ message: `${count} observation(s) recorded`, data: { count } });
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function getStudentProgress(req: Request, res: Response): Promise<void> {
  const summary = await observationsService.getStudentProgress(
    req.user!.tenantSchema, req.params.studentId
  );
  res.json({ data: summary });
}

export async function updateMilestone(req: Request, res: Response): Promise<void> {
  try {
    const row = await observationsService.updateMilestone(
      req.user!.tenantSchema, req.params['id'] as string, req.body);
    res.json({ data: row, message: 'Milestone updated' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function deleteMilestone(req: Request, res: Response): Promise<void> {
  try {
    await observationsService.deleteMilestone(req.user!.tenantSchema, req.params['id'] as string);
    res.json({ message: 'Milestone deleted' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}
