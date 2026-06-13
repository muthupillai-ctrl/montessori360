import { Request, Response } from 'express';
import { attendanceService } from './attendance.service.js';
import type { CheckInDto, CheckOutDto, BulkMarkDto, AttendanceFilters, MonthlyReportFilters } from './attendance.types.js';

export async function checkIn(req: Request, res: Response): Promise<void> {
  const record = await attendanceService.checkIn(
    req.user!.tenantSchema,
    req.body as CheckInDto,
    req.user!.sub,
  );
  res.status(201).json({ data: record, message: 'Check-in recorded successfully' });
}

export async function checkOut(req: Request, res: Response): Promise<void> {
  const record = await attendanceService.checkOut(
    req.user!.tenantSchema,
    req.body as CheckOutDto,
    req.user!.sub,
  );
  res.json({ data: record, message: 'Check-out recorded successfully' });
}

export async function bulkMark(req: Request, res: Response): Promise<void> {
  const count = await attendanceService.bulkMark(
    req.user!.tenantSchema,
    req.body as BulkMarkDto,
    req.user!.sub,
  );
  res.json({ message: `${count} attendance record(s) saved`, data: { count } });
}

export async function getDailySummary(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as AttendanceFilters;
  const summary = await attendanceService.dailySummary(req.user!.tenantSchema, filters);
  res.json({ data: summary });
}

export async function listAttendance(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as AttendanceFilters;
  const result = await attendanceService.list(req.user!.tenantSchema, filters);
  res.json(result);
}

export async function getMonthlyReport(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as MonthlyReportFilters;
  const report = await attendanceService.monthlyReport(req.user!.tenantSchema, filters);
  res.json({ data: report });
}
