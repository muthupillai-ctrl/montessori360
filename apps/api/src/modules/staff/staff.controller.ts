import { Request, Response } from 'express';
import { staffService } from './staff.service.js';
import type {
  CreateStaffDto, UpdateStaffDto, RequestLeaveDto,
  ReviewLeaveDto, CreateShiftDto, StaffFilters, LeaveFilters, PayrollExportFilters,
} from './staff.types.js';

// ── Staff CRUD ────────────────────────────────────────────────────────────────


// ── Role hierarchy guard ──────────────────────────────────────────────────────
// owner   → can manage everyone
// principal → can manage everyone EXCEPT owner and other principals
function checkCanManage(actorRole: string, targetRole: string): void {
  if (actorRole === 'owner') return; // owner can do anything
  if (actorRole === 'principal') {
    if (targetRole === 'owner' || targetRole === 'principal') {
      throw Object.assign(new Error('Principals cannot manage owner or other principal accounts'), { statusCode: 403 });
    }
    return;
  }
  throw Object.assign(new Error('Insufficient permissions'), { statusCode: 403 });
}

export async function listStaff(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as StaffFilters;
  const result = await staffService.list(req.user!.tenantSchema, filters);
  res.json(result);
}

export async function getStaffMember(req: Request, res: Response): Promise<void> {
  const id = req.params.id === 'me' ? req.user!.sub : req.params.id;
  const row = await staffService.getById(req.user!.tenantSchema, id);
  res.json({ data: row });
}

export async function createStaffMember(req: Request, res: Response): Promise<void> {
  try { checkCanManage(req.user!.role, req.body.role); } catch (e: any) {
    res.status(e.statusCode ?? 403).json({ error: { code: 'FORBIDDEN', message: e.message } }); return;
  }
  const row = await staffService.create(
    req.user!.tenantSchema, req.body as CreateStaffDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Staff member created successfully' });
}

export async function updateStaffMember(req: Request, res: Response): Promise<void> {
  const target = await staffService.getById(req.user!.tenantSchema, req.params['id'] as string);
  try { checkCanManage(req.user!.role, target.role); } catch (e: any) {
    res.status(e.statusCode ?? 403).json({ error: { code: 'FORBIDDEN', message: e.message } }); return;
  }
  const row = await staffService.update(
    req.user!.tenantSchema, req.params.id, req.body as UpdateStaffDto, req.user!.sub
  );
  res.json({ data: row, message: 'Staff member updated successfully' });
}

export async function deactivateStaffMember(req: Request, res: Response): Promise<void> {
  const target = await staffService.getById(req.user!.tenantSchema, req.params['id'] as string);
  try { checkCanManage(req.user!.role, target.role); } catch (e: any) {
    res.status(e.statusCode ?? 403).json({ error: { code: 'FORBIDDEN', message: e.message } }); return;
  }
  await staffService.deactivate(req.user!.tenantSchema, req.params.id);
  res.json({ message: 'Staff member deactivated successfully' });
}

// ── Leave ─────────────────────────────────────────────────────────────────────

export async function getLeaveBalance(req: Request, res: Response): Promise<void> {
  const staffId = req.params.staffId ?? req.user!.sub;
  const row = await staffService.getLeaveBalance(req.user!.tenantSchema, staffId, req.query.year as string);
  res.json({ data: row });
}

export async function listLeaveRequests(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as LeaveFilters;
  const role    = req.user!.role;
  const hrRoles = ['owner', 'principal', 'accountant'];
  // Non-HR always scoped to own requests
  // HR: if staff_id is explicitly passed, respect it; otherwise see all
  if (!hrRoles.includes(role)) {
    filters.staff_id = req.user!.sub;
  }
  const result = await staffService.listLeaveRequests(req.user!.tenantSchema, filters);
  res.json(result);
}

export async function requestLeave(req: Request, res: Response): Promise<void> {
  const row = await staffService.requestLeave(
    req.user!.tenantSchema, req.user!.sub, req.body as RequestLeaveDto
  );
  res.status(201).json({ data: row, message: 'Leave request submitted successfully' });
}

export async function reviewLeave(req: Request, res: Response): Promise<void> {
  const row = await staffService.reviewLeave(
    req.user!.tenantSchema, req.params.id, req.body as ReviewLeaveDto, req.user!.sub
  );
  res.json({ data: row, message: `Leave request ${row.status}` });
}

export async function cancelLeave(req: Request, res: Response): Promise<void> {
  await staffService.cancelLeave(req.user!.tenantSchema, req.params.id, req.user!.sub);
  res.json({ message: 'Leave request cancelled' });
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export async function listShifts(req: Request, res: Response): Promise<void> {
  const { staff_id, from, to } = req.query as { staff_id?: string; from?: string; to?: string };
  const rows = await staffService.listShifts(req.user!.tenantSchema, staff_id, from, to);
  res.json({ data: rows });
}

export async function createShift(req: Request, res: Response): Promise<void> {
  const row = await staffService.createShift(
    req.user!.tenantSchema, req.body as CreateShiftDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Shift created successfully' });
}

export async function deleteShift(req: Request, res: Response): Promise<void> {
  await staffService.deleteShift(req.user!.tenantSchema, req.params.id);
  res.json({ message: 'Shift deleted successfully' });
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export async function getPayrollReport(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as PayrollExportFilters;
  const rows = await staffService.generatePayrollExport(req.user!.tenantSchema, filters);
  res.json({ data: rows });
}

export async function downloadPayrollCsv(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as PayrollExportFilters;
  const rows = await staffService.generatePayrollExport(req.user!.tenantSchema, filters);
  const csv  = staffService.formatPayrollCsv(rows, filters.month, filters.year);
  const filename = `payroll-${filters.year}-${String(filters.month).padStart(2,'0')}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function listAllLeaveBalances(req: Request, res: Response): Promise<void> {
  const schema       = req.user!.tenantSchema;
  const academicYear = (req.query.academic_year as string) ?? '';
  const { tenantQuery } = await import('../../config/database.js');

  const rows = await tenantQuery<any>(schema,
    `SELECT lb.*,
            CONCAT(s.first_name, ' ', s.last_name) AS staff_name,
            s.role, sd.employee_no
     FROM   ${schema}.leave_balances lb
     JOIN   ${schema}.staff s ON s.id = lb.staff_id
     LEFT JOIN ${schema}.staff_details sd ON sd.staff_id = lb.staff_id
     WHERE  ($1 = '' OR lb.academic_year = $1)
     ORDER  BY s.first_name`,
    [academicYear]
  );
  res.json({ data: rows });
}

export async function updateLeaveBalance(req: Request, res: Response): Promise<void> {
  const schema   = req.user!.tenantSchema;
  const staffId  = req.params['id'] as string;
  const { academic_year, casual, sick, earned } = req.body;
  const { tenantQuery } = await import('../../config/database.js');

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (casual  !== undefined) { fields.push(`casual = $${i++}`);  values.push(+casual); }
  if (sick    !== undefined) { fields.push(`sick = $${i++}`);    values.push(+sick); }
  if (earned  !== undefined) { fields.push(`earned = $${i++}`);  values.push(+earned); }
  if (!fields.length) { res.status(400).json({ error: { message: 'No fields to update' } }); return; }

  values.push(staffId, academic_year);
  const [row] = await tenantQuery<any>(schema,
    `UPDATE ${schema}.leave_balances SET ${fields.join(', ')}
     WHERE staff_id = $${i++} AND academic_year = $${i} RETURNING *`,
    values
  );
  if (!row) { res.status(404).json({ error: { message: 'Leave balance not found' } }); return; }
  res.json({ data: row });
}

export async function initAllLeaveBalances(req: Request, res: Response): Promise<void> {
  const schema       = req.user!.tenantSchema;
  const academicYear = req.body.academic_year;
  const { tenantQuery, tenantTransaction } = await import('../../config/database.js');

  const staff = await tenantQuery<any>(schema,
    `SELECT id FROM ${schema}.staff WHERE is_active = true`, []
  );

  let count = 0;
  for (const s of staff) {
    await tenantQuery(schema,
      `INSERT INTO ${schema}.leave_balances (staff_id, academic_year, casual, sick, earned)
       VALUES ($1, $2, 12, 12, 15)
       ON CONFLICT (staff_id, academic_year) DO NOTHING`,
      [s.id, academicYear]
    );
    count++;
  }
  res.json({ data: { count }, message: `${count} staff balances initialised` });
}

export async function getMyPaySlip(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const staffId = req.user!.sub;
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
  const year  = parseInt(req.query.year  as string) || new Date().getFullYear();

  const rows = await staffService.generatePayrollExport(schema, { month, year });
  const slip = rows.find((r: any) => r.staff_id === staffId);
  if (!slip) { res.status(404).json({ error: { message: 'No payroll record found' } }); return; }
  res.json({ data: slip });
}
