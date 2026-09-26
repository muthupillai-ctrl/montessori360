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

export async function listSchoolAdmins(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.listSchoolAdmins(req.params['id'] as string);
    res.json({ data });
  } catch (err) { next(err); }
}

export async function listAllPlans(req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await platformAdminService.listAllPlans() }); } catch (err) { next(err); }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.createPlan(req.body);
    res.status(201).json({ data, message: `Plan "${data.display_name}" created` });
  } catch (err) { next(err); }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.updatePlan(String(req.params.id), req.body);
    res.json({ data, message: 'Plan updated' });
  } catch (err) { next(err); }
}

export async function archivePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.setPlanArchived(String(req.params.id), req.body?.is_archived !== false);
    res.json({ data, message: data.is_archived ? 'Plan archived' : 'Plan restored' });
  } catch (err) { next(err); }
}

export async function deletePlan(req: Request, res: Response, next: NextFunction) {
  try {
    await platformAdminService.deletePlan(String(req.params.id));
    res.json({ message: 'Plan deleted' });
  } catch (err) { next(err); }
}

export async function updateSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.updateSubscription(String(req.params.id), req.body);
    res.json({ data, message: 'Subscription updated' });
  } catch (err) { next(err); }
}

export async function listOwners(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.listOwners(String(req.params.id));
    res.json({ data });
  } catch (err) { next(err); }
}

export async function createOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.createOwner(String(req.params.id), req.body);
    res.status(201).json({ data, message: 'Owner added' });
  } catch (err) { next(err); }
}

export async function updateOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await platformAdminService.updateOwner(String(req.params.id), String(req.params.staffId), req.body);
    res.json({ data, message: 'Owner updated' });
  } catch (err) { next(err); }
}

export async function deleteOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await platformAdminService.deleteOwner(String(req.params.id), String(req.params.staffId));
    res.json({
      data: result,
      message: result.deleted ? 'Owner deleted' : 'Owner has school records, so the account was deactivated instead',
    });
  } catch (err) { next(err); }
}

export async function resetStaffPassword(req: Request, res: Response, next: NextFunction) {
  try {
    await platformAdminService.resetStaffPassword(
      req.params['id'] as string,
      req.params['staffId'] as string,
      req.body.password
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
}
