import { Request, Response } from 'express';
import { studentsService } from './students.service.js';
import type { CreateStudentDto, UpdateStudentDto, StudentFilters, AssignClassDto } from './students.types.js';

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
    const row = await studentsService.updateClass(req.user!.tenantSchema, classId, req.body);
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
