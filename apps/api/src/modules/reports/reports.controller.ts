import { Request, Response } from 'express';
import { generateProgressCard } from './progress-card.generator.js';
import { templateService } from './template.service.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { CreateTemplateDto, UpdateTemplateDto } from './template.types.js';

// ── Templates ─────────────────────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response): Promise<void> {
  const rows = await templateService.list(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function getTemplate(req: Request, res: Response): Promise<void> {
  const row = await templateService.getById(req.user!.tenantSchema, String(req.params.id));
  res.json({ data: row });
}

export async function createTemplate(req: Request, res: Response): Promise<void> {
  const row = await templateService.create(
    req.user!.tenantSchema, req.body as CreateTemplateDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Template created successfully' });
}

export async function updateTemplate(req: Request, res: Response): Promise<void> {
  const row = await templateService.update(
    req.user!.tenantSchema, String(req.params.id), req.body as UpdateTemplateDto, req.user!.sub
  );
  res.json({ data: row, message: 'Template updated successfully' });
}

export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  await templateService.deactivate(req.user!.tenantSchema, String(req.params.id));
  res.json({ message: 'Template deleted successfully' });
}

export async function assignTemplateToClass(req: Request, res: Response): Promise<void> {
  const { classId } = req.params;
  const { template_id } = req.body as { template_id: string };
  await templateService.assignToClass(req.user!.tenantSchema, String(classId), template_id);
  res.json({ message: 'Template assigned to class successfully' });
}

export async function unassignTemplateFromClass(req: Request, res: Response): Promise<void> {
  await templateService.unassignFromClass(req.user!.tenantSchema, String(req.params.classId));
  res.json({ message: 'Class reverted to school default template' });
}

// ── PDF generation ────────────────────────────────────────────────────────────

export async function getProgressCard(req: Request, res: Response): Promise<void> {
  const { studentId } = req.params;
  const {
    term  = 'Term 1 2025-2026',
    from  = new Date(new Date().getFullYear(), 5, 1).toISOString().slice(0, 10),
    to    = new Date().toISOString().slice(0, 10),
  } = req.query as Record<string, string>;

  if (!studentId) throw AppError.badRequest('studentId is required');

  const stream = await generateProgressCard(
    req.user!.tenantSchema, String(studentId), term, from, to
  );

  const filename = `progress-card-${studentId}-${term.replace(/\s+/g, '-')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  stream.pipe(res);
}
