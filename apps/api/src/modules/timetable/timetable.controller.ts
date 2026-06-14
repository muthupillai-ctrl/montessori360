import type { Request, Response } from 'express';
import { timetableService } from './timetable.service.js';

// ── Subjects ──────────────────────────────────────────────────────────────────

export async function listSubjects(req: Request, res: Response) {
  const data = await timetableService.listSubjects(req.user!.tenantSchema);
  res.json({ data });
}

export async function createSubject(req: Request, res: Response) {
  const data = await timetableService.createSubject(req.user!.tenantSchema, req.body);
  res.status(201).json({ data });
}

export async function updateSubject(req: Request, res: Response) {
  const data = await timetableService.updateSubject(req.user!.tenantSchema, req.params.id, req.body);
  res.json({ data });
}

// ── Period Templates ──────────────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response) {
  const data = await timetableService.listTemplates(req.user!.tenantSchema);
  res.json({ data });
}

export async function getTemplate(req: Request, res: Response) {
  const data = await timetableService.getTemplate(req.user!.tenantSchema, req.params.id);
  res.json({ data });
}

export async function createTemplate(req: Request, res: Response) {
  const data = await timetableService.createTemplate(req.user!.tenantSchema, req.body);
  res.status(201).json({ data });
}

export async function updateTemplate(req: Request, res: Response) {
  const data = await timetableService.updateTemplate(req.user!.tenantSchema, req.params.id, req.body);
  res.json({ data });
}

// ── Timetables ────────────────────────────────────────────────────────────────

export async function listTimetables(req: Request, res: Response) {
  const data = await timetableService.listTimetables(req.user!.tenantSchema);
  res.json({ data });
}

export async function getTimetable(req: Request, res: Response) {
  const data = await timetableService.getTimetable(req.user!.tenantSchema, req.params.id);
  res.json({ data });
}

export async function createTimetable(req: Request, res: Response) {
  const data = await timetableService.createTimetable(req.user!.tenantSchema, req.body);
  res.status(201).json({ data });
}

export async function updateTimetable(req: Request, res: Response) {
  const data = await timetableService.updateTimetable(req.user!.tenantSchema, req.params.id, req.body);
  res.json({ data });
}

export async function upsertSlot(req: Request, res: Response) {
  const approverId = ['owner','principal'].includes(req.user!.role) ? req.user!.sub : undefined;
  const data = await timetableService.upsertSlot(
    req.user!.tenantSchema, req.params.id, req.body, approverId
  );
  res.json({ data });
}

export async function clearSlot(req: Request, res: Response) {
  const { template_slot_id, day_of_week } = req.body;
  await timetableService.clearSlot(
    req.user!.tenantSchema, req.params.id, template_slot_id, day_of_week
  );
  res.json({ data: { cleared: true } });
}

export async function getTeacherSchedule(req: Request, res: Response) {
  const teacherId = req.params.teacherId === 'me' ? req.user!.sub : req.params.teacherId;
  const year = req.query.academic_year as string || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
  const data = await timetableService.getTeacherSchedule(req.user!.tenantSchema, teacherId, year);
  res.json({ data });
}

export async function getClassSubjectTeachers(req: Request, res: Response) {
  const data = await timetableService.getClassSubjectTeachers(
    req.user!.tenantSchema, req.params.classId
  );
  res.json({ data });
}

export async function upsertClassSubjectTeacher(req: Request, res: Response) {
  const { subject_id, teacher_id } = req.body;
  if (!subject_id) {
    res.status(400).json({ error: { message: 'subject_id is required' } });
    return;
  }
  const data = await timetableService.upsertClassSubjectTeacher(
    req.user!.tenantSchema, req.params.classId, subject_id, teacher_id ?? null
  );
  res.json({ data });
}

export async function getSubjectTeacherLookup(req: Request, res: Response) {
  const { class_id, subject_id } = req.query as any;
  const teacherId = await timetableService.getSubjectTeacherForSlot(
    req.user!.tenantSchema, class_id, subject_id
  );
  res.json({ data: { teacher_id: teacherId } });
}
