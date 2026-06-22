import { Request, Response, NextFunction } from 'express';
import { platformAdminService } from './platform-admin.service.js';
import { usageService } from '../ai/usage.service.js';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await platformAdminService.login(email, password);
    res.json({ data: result });
  } catch (err) { next(err); }
}

export async function listTenants(req: Request, res: Response, next: NextFunction) {
  try {
    const tenants = await platformAdminService.listTenants();
    res.json({ data: tenants });
  } catch (err) { next(err); }
}

export async function getTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformAdminService.getTenant(String(req.params.id));
    res.json({ data: tenant });
  } catch (err) { next(err); }
}

export async function createTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformAdminService.createTenant(req.body);
    res.status(201).json({ data: tenant, message: `School "${tenant.name}" provisioned successfully` });
  } catch (err) { next(err); }
}

export async function updateTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformAdminService.updateTenant(String(req.params.id), req.body);
    res.json({ data: tenant, message: 'School updated' });
  } catch (err) { next(err); }
}

export async function toggleActive(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await platformAdminService.toggleActive(String(req.params.id));
    res.json({ data: tenant, message: tenant.is_active ? 'School activated' : 'School suspended' });
  } catch (err) { next(err); }
}

export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await platformAdminService.listPlans();
    res.json({ data: plans });
  } catch (err) { next(err); }
}


export async function getAiUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await usageService.platformSummary();
    res.json({ data });
  } catch (err) { next(err); }
}
