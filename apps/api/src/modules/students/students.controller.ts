import { Request, Response } from 'express';
import { studentsService } from './students.service.js';
import type { CreateStudentDto, UpdateStudentDto, StudentFilters, AssignClassDto } from './students.types.js';
import { sendParentInviteEmail } from '../../utils/email.js';
import { query } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';

// ── Students ──────────────────────────────────────────────────────────────────

export async function listStudents(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const filters = ((req as any).parsedQuery ?? req.query) as StudentFilters;
  const result = await studentsService.list(schema, filters);
  res.json(result);
}

export async function getStudent(req: Request, res: Response): Promise<void> {
  const student = await studentsService.getById(req.user!.tenantSchema, req.params['id'] as string);
  res.json({ data: student });
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  const student = await studentsService.create(
    req.user!.tenantSchema,
    req.body as CreateStudentDto,
    req.user!.sub,
  );
  res.status(201).json({ data: student, message: 'Student enrolled successfully' });
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  const student = await studentsService.update(
    req.user!.tenantSchema,
    req.params['id'] as string,
    req.body as UpdateStudentDto,
    req.user!.sub,
  );
  res.json({ data: student, message: 'Student updated successfully' });
}

export async function deactivateStudent(req: Request, res: Response): Promise<void> {
  await studentsService.deactivate(req.user!.tenantSchema, req.params['id'] as string, req.user!.sub);
  res.json({ message: 'Student deactivated successfully' });
}

export async function assignClass(req: Request, res: Response): Promise<void> {
  try {
    const student = await studentsService.assignClass(
      req.user!.tenantSchema,
      req.params['id'] as string,
      req.body as AssignClassDto,
      req.user!.sub,
    );
    res.json({ data: student, message: 'Class assigned successfully' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function getSiblings(req: Request, res: Response): Promise<void> {
  const student = await studentsService.getById(req.user!.tenantSchema, req.params['id'] as string);
  const siblings = await Promise.all(
    (student.sibling_ids ?? []).map((sibId) =>
      studentsService.getById(req.user!.tenantSchema, sibId)
    )
  );
  res.json({ data: siblings });
}

export async function linkSiblings(req: Request, res: Response): Promise<void> {
  const { student_id_a, student_id_b } = req.body as { student_id_a: string; student_id_b: string };
  await studentsService.linkSiblings(req.user!.tenantSchema, student_id_a, student_id_b, req.user!.sub);
  res.json({ message: 'Students linked as siblings' });
}

export async function unlinkSiblings(req: Request, res: Response): Promise<void> {
  const { student_id_a, student_id_b } = req.body as { student_id_a: string; student_id_b: string };
  await studentsService.unlinkSiblings(req.user!.tenantSchema, student_id_a, student_id_b, req.user!.sub);
  res.json({ message: 'Sibling link removed' });
}

export async function promoteStudents(req: Request, res: Response): Promise<void> {
  const { from_class_id, to_class_id } = req.body as { from_class_id: string; to_class_id: string };
  const count = await studentsService.promote(
    req.user!.tenantSchema,
    from_class_id,
    to_class_id,
    req.user!.sub,
  );
  res.json({ message: `${count} student(s) promoted successfully`, data: { count } });
}

// ── Classes ───────────────────────────────────────────────────────────────────

export async function listClasses(req: Request, res: Response): Promise<void> {
  const classes = await studentsService.listClasses(req.user!.tenantSchema);
  res.json({ data: classes });
}

export async function createClass(req: Request, res: Response): Promise<void> {
  const { name, capacity, age_group_min, age_group_max } = req.body;
  if (!name || !capacity) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name and capacity are required' } });
    return;
  }
  const [row] = await (await import('../../config/database.js')).tenantQuery(
    req.user!.tenantSchema,
    `INSERT INTO ${req.user!.tenantSchema}.classes (name, capacity, age_group_min, age_group_max)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, capacity, age_group_min ?? null, age_group_max ?? null]
  );
  res.status(201).json({ data: row, message: 'Class created successfully' });
}


export async function updateClass(req: Request, res: Response): Promise<void> {
  try {
    const { classId } = req.params;
    const row = await studentsService.updateClass(req.user!.tenantSchema,String( classId), req.body);
    res.json({ data: row, message: 'Class updated successfully' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function deleteClass(req: Request, res: Response): Promise<void> {
  try {
    await studentsService.deleteClass(req.user!.tenantSchema, req.params['classId'] as string);
    res.json({ message: 'Class deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

// ── Student Parents ───────────────────────────────────────────────────────────

export async function listParents(req: Request, res: Response): Promise<void> {
  const parents = await studentsService.listParents(
    req.user!.tenantSchema, req.params['studentId'] as string
  );
  res.json({ data: parents });
}

export async function createParent(req: Request, res: Response): Promise<void> {
  const parent = await studentsService.upsertParent(
    req.user!.tenantSchema, req.params['studentId'] as string, req.body
  );
  res.status(201).json({ data: parent });
}

export async function updateParent(req: Request, res: Response): Promise<void> {
  const parent = await studentsService.upsertParent(
    req.user!.tenantSchema, req.params['studentId'] as string,
    req.body, req.params['parentId'] as string
  );
  res.json({ data: parent });
}

export async function deleteParent(req: Request, res: Response): Promise<void> {
  await studentsService.deleteParent(
    req.user!.tenantSchema,
    req.params['studentId'] as string,
    req.params['parentId'] as string
  );
  res.json({ message: 'Parent record deleted' });
}

export async function listAllParents(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const search = req.query['search'] as string | undefined;
  const data   = await studentsService.listAllParents(schema, search);
  res.json({ data });
}

export async function listPortalAccounts(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const search = req.query['search'] as string | undefined;
  const status = req.query['status'] as string | undefined;
  const data   = await studentsService.listPortalAccounts(schema, search, status);
  res.json({ data });
}

export async function inviteParentByRecord(req: Request, res: Response): Promise<void> {
  const { authService } = await import('../auth/auth.service.js');
  const schema         = req.user!.tenantSchema;
  const parentRecordId = req.params['parentRecordId'] as string;

  const record = await studentsService.getParentRecordById(schema, parentRecordId);
  if (!record.email) throw AppError.badRequest('This parent has no email address — cannot invite');

  const { id, inviteToken } = await authService.createParentAccount(schema, record.student_id, {
    email:      record.email,
    first_name: record.first_name,
    last_name:  record.last_name,
    phone:      record.mobile ?? '',
    relation:   record.relation,
  });

  const [tenant] = await query<{ name: string }>(
    `SELECT name FROM public.tenants WHERE id = $1`, [req.user!.tenantId]
  );
  const appUrl     = process.env.APP_URL ?? 'http://localhost:4200';
  const inviteLink = `${appUrl}/parent/set-password?token=${inviteToken}`;
  await sendParentInviteEmail(record.email, inviteLink, `${record.first_name} ${record.last_name}`, tenant?.name ?? 'Your school');

  res.status(201).json({ data: { parentAccountId: id, inviteLink, emailSent: true } });
}

export async function resendParentInvite(req: Request, res: Response): Promise<void> {
  const { authService } = await import('../auth/auth.service.js');
  const schema    = req.user!.tenantSchema;
  const accountId = req.params['accountId'] as string;

  const [pa] = await (await import('../../config/database.js')).tenantQuery<{ email: string; first_name: string; last_name: string }>(
    schema,
    `SELECT email, first_name, last_name FROM parent_accounts WHERE id = $1`,
    [accountId]
  );
  if (!pa) throw AppError.notFound('Portal account');

  const token = await authService.resendParentInvite(schema, accountId);

  const [tenant] = await query<{ name: string }>(
    `SELECT name FROM public.tenants WHERE id = $1`, [req.user!.tenantId]
  );
  const appUrl     = process.env.APP_URL ?? 'http://localhost:4200';
  const inviteLink = `${appUrl}/parent/set-password?token=${token}`;
  await sendParentInviteEmail(pa.email, inviteLink, `${pa.first_name} ${pa.last_name}`, tenant?.name ?? 'Your school');

  res.json({ data: { sent: true } });
}

export async function togglePortalAccount(req: Request, res: Response): Promise<void> {
  const { authService } = await import('../auth/auth.service.js');
  const schema    = req.user!.tenantSchema;
  const accountId = req.params['accountId'] as string;
  const { is_active } = req.body as { is_active: boolean };
  await authService.togglePortalAccount(schema, accountId, is_active);
  res.json({ data: { updated: true } });
}

export async function deletePortalAccount(req: Request, res: Response): Promise<void> {
  const schema    = req.user!.tenantSchema;
  const accountId = req.params['accountId'] as string;
  const { tenantQuery } = await import('../../config/database.js');
  const rows = await tenantQuery<{ id: string }>(schema,
    `DELETE FROM parent_accounts WHERE id = $1 RETURNING id`, [accountId]
  );
  if (!rows.length) throw AppError.notFound('Portal account');
  res.json({ data: { deleted: true } });
}

export async function inviteParentToPortal(req: Request, res: Response): Promise<void> {
  const { authService } = await import('../auth/auth.service.js');
  const schema    = req.user!.tenantSchema;
  const studentId = req.params['studentId'] as string;
  const data      = req.body as { email: string; first_name: string; last_name: string; phone: string; relation: string };

  const { id, inviteToken } = await authService.createParentAccount(schema, studentId, data);

  const [tenant] = await query<{ name: string }>(
    `SELECT name FROM public.tenants WHERE id = $1`, [req.user!.tenantId]
  );
  const appUrl     = process.env.APP_URL ?? 'http://localhost:4200';
  const inviteLink = `${appUrl}/parent/set-password?token=${inviteToken}`;
  const parentName = `${data.first_name} ${data.last_name}`;
  await sendParentInviteEmail(data.email, inviteLink, parentName, tenant?.name ?? 'Your school');

  res.status(201).json({ data: { parentAccountId: id, inviteToken } });
}
