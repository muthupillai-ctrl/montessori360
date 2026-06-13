import { Request, Response } from 'express';
import { analyticsService } from './analytics.service.js';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const dashboard = await analyticsService.getDashboard(
    req.user!.tenantSchema, req.user!.sub
  );
  res.json({ data: dashboard });
}

export async function getAttendanceTrend(req: Request, res: Response): Promise<void> {
  const today     = new Date().toISOString().slice(0, 10);
  const monthAgo  = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { from = monthAgo, to = today } = req.query as { from?: string; to?: string };
  const rows = await analyticsService.getAttendanceTrend(req.user!.tenantSchema, from, to);
  res.json({ data: rows });
}

export async function getFeeCollection(req: Request, res: Response): Promise<void> {
  const today    = new Date().toISOString().slice(0, 10);
  const yearStart = today.slice(0, 4) + '-06-01';
  const { from = yearStart, to = today } = req.query as { from?: string; to?: string };
  const rows = await analyticsService.getFeeCollection(req.user!.tenantSchema, from, to);
  res.json({ data: rows });
}

export async function getStaffDashboard(req: Request, res: Response): Promise<void> {
  const data = await analyticsService.getStaffDashboard(req.user!.tenantSchema, req.user!.sub);
  res.json({ data });
}

export async function getLeaveOverview(req: Request, res: Response): Promise<void> {
  const data = await analyticsService.getLeaveOverview(req.user!.tenantSchema);
  res.json({ data });
}
