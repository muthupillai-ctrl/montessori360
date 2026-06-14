import { Request, Response } from 'express';
import { calendarService } from './calendar.service.js';
import type {
  CreateAcademicYearDto, CreateTermDto, CreateEventDto,
  CreateTimetableSlotDto, CalendarFilters,
} from './calendar.types.js';

// ── Academic Years ────────────────────────────────────────────────────────────

export async function listAcademicYears(req: Request, res: Response): Promise<void> {
  const rows = await calendarService.listAcademicYears(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function getCurrentYear(req: Request, res: Response): Promise<void> {
  const row = await calendarService.getCurrentYear(req.user!.tenantSchema);
  res.json({ data: row });
}

export async function createAcademicYear(req: Request, res: Response): Promise<void> {
  const row = await calendarService.createAcademicYear(
    req.user!.tenantSchema, req.body as CreateAcademicYearDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Academic year created successfully' });
}

export async function setCurrentYear(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const row = await calendarService.setCurrentYear(req.user!.tenantSchema, id);
  res.json({ data: row, message: `${row.name} set as current academic year` });
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export async function listTerms(req: Request, res: Response): Promise<void> {
  const academicYearId = req.query.academic_year_id as string | undefined;
  const rows = await calendarService.listTerms(req.user!.tenantSchema, academicYearId);
  res.json({ data: rows });
}

export async function createTerm(req: Request, res: Response): Promise<void> {
  const row = await calendarService.createTerm(req.user!.tenantSchema, req.body as CreateTermDto);
  res.status(201).json({ data: row, message: 'Term created successfully' });
}

export async function updateTerm(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const row = await calendarService.updateTerm(req.user!.tenantSchema, id, req.body as Partial<CreateTermDto>);
  res.json({ data: row, message: 'Term updated' });
}

export async function deleteTerm(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  await calendarService.deleteTerm(req.user!.tenantSchema, id);
  res.json({ message: 'Term deleted' });
}

export async function updateAcademicYear(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const row = await calendarService.updateAcademicYear(req.user!.tenantSchema, id, req.body);
  res.json({ data: row, message: 'Academic year updated' });
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function listEvents(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as CalendarFilters;
  const rows = await calendarService.listEvents(req.user!.tenantSchema, filters);
  res.json({ data: rows });
}

export async function getEvent(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const row = await calendarService.getEvent(req.user!.tenantSchema, id);
  res.json({ data: row });
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  const row = await calendarService.createEvent(
    req.user!.tenantSchema, req.body as CreateEventDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Event created successfully' });
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const row = await calendarService.updateEvent(
    req.user!.tenantSchema, id, req.body, req.user!.sub
  );
  res.json({ data: row, message: 'Event updated successfully' });
}

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  await calendarService.deleteEvent(req.user!.tenantSchema, id);
  res.json({ message: 'Event deleted successfully' });
}

export async function getWorkingDays(req: Request, res: Response): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const { from = firstOfMonth, to = today } = req.query as { from?: string; to?: string };
  const rows = await calendarService.getWorkingDays(req.user!.tenantSchema, from, to);
  res.json({ data: rows });
}

// ── Timetable ─────────────────────────────────────────────────────────────────

export async function getTimetable(req: Request, res: Response): Promise<void> {
  const rows = await calendarService.getTimetable(req.user!.tenantSchema, String(req.params.classId));
  res.json({ data: rows });
}

export async function createTimetableSlot(req: Request, res: Response): Promise<void> {
  const row = await calendarService.createTimetableSlot(
    req.user!.tenantSchema, req.body as CreateTimetableSlotDto
  );
  res.status(201).json({ data: row, message: 'Timetable slot created successfully' });
}

export async function deleteTimetableSlot(req: Request, res: Response): Promise<void> {
  await calendarService.deleteTimetableSlot(req.user!.tenantSchema, String(req.params.id));
  res.json({ message: 'Timetable slot deleted successfully' });
}

export async function bulkReplaceTimetable(req: Request, res: Response): Promise<void> {
  const { class_id, slots } = req.body as { class_id: string; slots: CreateTimetableSlotDto[] };
  const rows = await calendarService.bulkReplaceTimetable(req.user!.tenantSchema, class_id, slots);
  res.json({ data: rows, message: `${rows.length} timetable slots saved` });
}
