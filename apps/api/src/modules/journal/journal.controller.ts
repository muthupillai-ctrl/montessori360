import { Request, Response } from 'express';
import { journalService } from './journal.service.js';
import type { CreateJournalDto, UpdateJournalDto, JournalFilters } from './journal.types.js';

export async function listJournals(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as JournalFilters;
  const result = await journalService.list(req.user!.tenantSchema, filters);
  res.json(result);
}

export async function getJournal(req: Request, res: Response): Promise<void> {
  const row = await journalService.getById(req.user!.tenantSchema, String(req.params.id));
  res.json({ data: row });
}

export async function getStudentJournalByDate(req: Request, res: Response): Promise<void> {
  const { studentId, date } = req.params;
  const row = await journalService.getByStudentAndDate(req.user!.tenantSchema, String(studentId), String(date));
  if (!row) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No journal found for this date' } });
    return;
  }
  res.json({ data: row });
}

export async function createJournal(req: Request, res: Response): Promise<void> {
  const row = await journalService.create(
    req.user!.tenantSchema, req.body as CreateJournalDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Journal created successfully' });
}

export async function updateJournal(req: Request, res: Response): Promise<void> {
  const row = await journalService.update(
    req.user!.tenantSchema, String(req.params.id), req.body as UpdateJournalDto, req.user!.sub
  );
  res.json({ data: row, message: 'Journal updated successfully' });
}

export async function publishJournal(req: Request, res: Response): Promise<void> {
  const row = await journalService.publish(req.user!.tenantSchema, String(req.params.id));
  res.json({ data: row, message: 'Journal published to parents' });
}

export async function bulkPublishJournals(req: Request, res: Response): Promise<void> {
  const { class_id, date } = req.body as { class_id: string; date?: string };
  if (!class_id) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'class_id is required' } });
    return;
  }
  const count = await journalService.bulkPublish(req.user!.tenantSchema, class_id, date);
  res.json({ message: `${count} journal(s) published`, data: { count } });
}

export async function getClassOverview(req: Request, res: Response): Promise<void> {
  const classId = req.params.classId;
  const date    = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  const rows    = await journalService.classOverview(req.user!.tenantSchema, String(classId), date);
  res.json({ data: rows });
}

export async function getMoodTrend(req: Request, res: Response): Promise<void> {
  const { studentId } = req.params;
  const days = parseInt(req.query.days as string ?? '30');
  const data = await journalService.moodTrend(req.user!.tenantSchema, String(studentId), days);
  res.json({ data });
}

export async function getSchoolMoodSummary(req: Request, res: Response): Promise<void> {
  const today     = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const from = (req.query.from as string) ?? thirtyAgo;
  const to   = (req.query.to   as string) ?? today;
  const data = await journalService.schoolMoodSummary(req.user!.tenantSchema, from, to);
  res.json({ data });
}

export async function getCompletionReport(req: Request, res: Response): Promise<void> {
  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  const data = await journalService.completionReport(req.user!.tenantSchema, date);
  res.json({ data });
}

export async function getWeeklyDigest(req: Request, res: Response): Promise<void> {
  const { studentId } = req.params;
  const weekStart = (req.query.week_start as string) ?? getMonday();
  const data = await journalService.weeklyDigest(req.user!.tenantSchema, String(studentId), weekStart);
  res.json({ data });
}

function getMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - (d.getDay() || 7) + 1);
  return d.toISOString().slice(0, 10);
}
