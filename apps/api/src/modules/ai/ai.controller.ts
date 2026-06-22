import { Request, Response } from 'express';
import { insightsService } from './insights.service.js';
import { languageService } from './language.service.js';
import { usageService } from './usage.service.js';

export async function listInsights(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const data   = await insightsService.listUnresolved(schema);
  res.json({ data });
}

export async function insightsCount(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const count  = await insightsService.unresolvedCount(schema);
  res.json({ data: { count } });
}

export async function resolveInsight(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  await insightsService.resolve(schema, String(req.params.id));
  res.json({ data: { ok: true } });
}

export async function triggerInsightsRun(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const result = await insightsService.runForSchema(schema);
  res.json({ data: result });
}

export async function resolveAllInsights(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  await insightsService.resolveAll(schema);
  res.json({ data: { ok: true } });
}

export async function remarkAssist(req: Request, res: Response): Promise<void> {
  const {
    student_name, class_name, journal_date,
    mood, mood_note, activities, existing_note,
  } = req.body as {
    student_name:  string;
    class_name?:   string;
    journal_date:  string;
    mood?:         string;
    mood_note?:    string;
    activities?:   Array<{ type: string; description: string; duration_mins?: number }>;
    existing_note?: string;
  };

  if (!student_name || !journal_date) {
    res.status(400).json({ error: { message: 'student_name and journal_date are required' } });
    return;
  }

  const text = await languageService.generateRemark({
    student_name, class_name, journal_date, mood, mood_note, activities, existing_note,
    tenantSchema: req.user!.tenantSchema,
  });
  res.json({ data: { text } });
}

export async function schoolUsage(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const data   = await usageService.schoolSummary(schema);
  res.json({ data });
}
