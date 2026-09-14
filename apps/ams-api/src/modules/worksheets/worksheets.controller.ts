import { Request, Response } from 'express';
import { worksheetsService } from './worksheets.service.js';
import type { CreateWorksheetDto, UpdateWorksheetDto, WorksheetFilters } from './worksheets.types.js';

export async function listWorksheets(req: Request, res: Response): Promise<void> {
  const rows = await worksheetsService.list(req.user!.tenantSchema, req.query as WorksheetFilters);
  res.json({ data: rows });
}

export async function getWorksheet(req: Request, res: Response): Promise<void> {
  const row = await worksheetsService.getById(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ data: row });
}

export async function createWorksheet(req: Request, res: Response): Promise<void> {
  const row = await worksheetsService.create(req.user!.tenantSchema, req.body as CreateWorksheetDto, req.user!.sub);
  res.status(201).json({ data: row, message: 'Worksheet created' });
}

export async function updateWorksheet(req: Request, res: Response): Promise<void> {
  const row = await worksheetsService.update(req.user!.tenantSchema, req.params['id'] as string, req.body as UpdateWorksheetDto);
  res.json({ data: row, message: 'Worksheet updated' });
}

export async function deleteWorksheet(req: Request, res: Response): Promise<void> {
  await worksheetsService.delete(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ message: 'Worksheet deleted' });
}

export async function generateWorksheet(req: Request, res: Response): Promise<void> {
  const row = await worksheetsService.generate(req.user!.tenantSchema, req.body, req.user!.sub);
  res.status(201).json({ data: row, message: 'Worksheet generated' });
}

export async function uploadWorksheet(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
    return;
  }
  const schema = req.user!.tenantSchema;
  const fileUrl = `/uploads/${schema}/${req.file.filename}`;
  const dto = {
    title:        (req.body.title as string) || req.file.originalname.replace(/\.[^.]+$/, ''),
    description:  req.body.description  || undefined,
    subject:      req.body.subject      || undefined,
    grade_level:  req.body.grade_level  || undefined,
    level:        req.body.level        || undefined,
    file_url:     fileUrl,
    is_published: req.body.is_published === 'true',
  };
  const row = await worksheetsService.create(schema, dto, req.user!.sub);
  res.status(201).json({ data: row, message: 'Worksheet uploaded' });
}
