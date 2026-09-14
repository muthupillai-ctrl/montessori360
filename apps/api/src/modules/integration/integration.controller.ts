import { Request, Response } from 'express';
import { integrationService } from './integration.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export async function listKeys(req: Request, res: Response): Promise<void> {
  const rows = await integrationService.listKeys(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function createKey(req: Request, res: Response): Promise<void> {
  const { name } = req.body as { name: string };
  if (!name?.trim()) throw AppError.badRequest('Key name is required');

  const { row, plainKey } = await integrationService.createKey(
    req.user!.tenantSchema, name.trim(), req.user!.sub
  );
  // plainKey returned once — never stored in plain text again
  res.status(201).json({ data: { ...row, key: plainKey }, message: 'API key created. Copy it now — it will not be shown again.' });
}

export async function revokeKey(req: Request, res: Response): Promise<void> {
  const ok = await integrationService.revokeKey(req.user!.tenantSchema, req.params['id'] as string);
  if (!ok) throw AppError.notFound('API key');
  res.json({ message: 'API key revoked' });
}

export async function deleteKey(req: Request, res: Response): Promise<void> {
  const ok = await integrationService.deleteKey(req.user!.tenantSchema, req.params['id'] as string);
  if (!ok) throw AppError.notFound('API key');
  res.json({ message: 'API key deleted' });
}
