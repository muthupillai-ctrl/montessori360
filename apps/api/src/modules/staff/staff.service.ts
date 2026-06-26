import bcrypt from 'bcryptjs';
import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  StaffRow, LeaveBalanceRow, LeaveRequestRow, ShiftRow,
  CreateStaffDto, UpdateStaffDto, RequestLeaveDto, ReviewLeaveDto,
  CreateShiftDto, StaffFilters, LeaveFilters, PayrollExportFilters,
} from './staff.types.js';
import type { PaginatedResponse } from '@montessori360/shared';

const CACHE_TTL = 300;

class StaffService {

  // ── Staff CRUD ────────────────────────────────────────────────────────────

  async list(schema: string, filters: StaffFilters): Promise<PaginatedResponse<StaffRow>> {
    const { role, is_active = true, search, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['s.is_active = $1'];
    const params: unknown[] = [is_active];
    let i = 2;

    if (role) {
      const roles = role.split(',').map((r: string) => r.trim()).filter(Boolean);
      if (roles.length === 1) {
        conditions.push(`s.role = $${i++}`);
        params.push(roles[0]);
      } else {
        const placeholders = roles.map(() => `$${i++}`).join(', ');
        conditions.push(`s.role IN (${placeholders})`);
        params.push(...roles);
      }
    }
    if (search) {
      conditions.push(`(s.first_name ILIKE $${i} OR s.last_name ILIKE $${i} OR s.email ILIKE $${i} OR sd.employee_no ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total
       FROM ${schema}.staff s
       LEFT JOIN ${schema}.staff_details sd ON sd.staff_id = s.id
       ${where}`,
      params
    );

    params.push(limit, offset);
    const rows = await tenantQuery<StaffRow>(
      schema,
      `SELECT s.id, s.email, s.role, s.first_name, s.last_name,
              s.phone, s.dob::text, s.joining_date::text,
              s.qualifications, s.profile_photo, s.is_active,
              s.created_at, s.updated_at,
              sd.employee_no, sd.department, sd.designation,
              sd.salary, sd.pay_frequency
       FROM   ${schema}.staff s
       LEFT JOIN ${schema}.staff_details sd ON sd.staff_id = s.id
       ${where}
       ORDER  BY s.first_name, s.last_name
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    return {
      data: rows,
      meta: { total: parseInt(countRow.total), page, limit, totalPages: Math.ceil(parseInt(countRow.total) / limit) },
    };
  }

  async getById(schema: string, id: string): Promise<StaffRow> {
    const cacheKey = `${schema}:staff:${id}`;
    const cached = await cacheGet<StaffRow>(cacheKey);
    if (cached) return cached;

    const [row] = await tenantQuery<StaffRow>(
      schema,
      `SELECT s.id, s.email, s.role, s.first_name, s.last_name,
              s.phone, s.dob::text, s.joining_date::text,
              s.qualifications, s.profile_photo, s.is_active,
              s.created_at, s.updated_at,
              sd.employee_no, sd.department, sd.designation,
              sd.salary, sd.pay_frequency, sd.bank_account,
              sd.bank_ifsc, sd.pan_no, sd.aadhar_no,
              sd.address, sd.emergency_contact
       FROM   ${schema}.staff s
       LEFT JOIN ${schema}.staff_details sd ON sd.staff_id = s.id
       WHERE  s.id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('Staff member');
    await cacheSet(cacheKey, row, CACHE_TTL);
    return row;
  }

  async create(schema: string, dto: CreateStaffDto, createdBy: string): Promise<StaffRow> {
    return tenantTransaction(schema, async (client) => {
      // Check email uniqueness
      const { rows: [existing] } = await client.query(
        `SELECT id FROM ${schema}.staff WHERE email = $1`, [dto.email.toLowerCase()]
      );
      if (existing) throw AppError.conflict(`Email '${dto.email}' is already registered`);

      const hash = await bcrypt.hash(dto.password, 12);
      const joiningDate = dto.joining_date ?? new Date().toISOString().slice(0, 10);

      // Auto-generate employee_no if not provided
      let employeeNo = dto.employee_no ?? null;
      if (!employeeNo) {
        const [{ count }] = await tenantQuery<{ count: string }>(
          schema, `SELECT COUNT(*)::text AS count FROM ${schema}.staff`, []
        );
        const seq = String(parseInt(count) + 1).padStart(3, '0');
        employeeNo = `EMP-${seq}`;
      }

      const { rows: [staff] } = await client.query(
        `INSERT INTO ${schema}.staff
           (email, password_hash, role, first_name, last_name, phone,
            dob, joining_date, qualifications)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          dto.email.toLowerCase(), hash, dto.role,
          dto.first_name, dto.last_name,
          dto.phone ?? null, dto.dob ?? null, joiningDate,
          JSON.stringify(dto.qualifications ?? []),
        ]
      );

      // Insert staff_details
      await client.query(
        `INSERT INTO ${schema}.staff_details
           (staff_id, employee_no, department, designation, salary, pay_frequency,
            bank_account, bank_ifsc, pan_no, aadhar_no, address, emergency_contact)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          staff.id,
          employeeNo, dto.department ?? null, dto.designation ?? null,
          dto.salary ?? null, dto.pay_frequency ?? 'monthly',
          dto.bank_account ?? null, dto.bank_ifsc ?? null,
          dto.pan_no ?? null, dto.aadhar_no ?? null,
          dto.address ?? null,
          dto.emergency_contact ? JSON.stringify(dto.emergency_contact) : null,
        ]
      );

      // Initialise leave balance for current year
      await this.initLeaveBalance(schema, staff.id, client);
      await cacheDelPattern(`${schema}:staff:list:*`);
      return staff as StaffRow;
    });
  }

  async update(schema: string, id: string, dto: UpdateStaffDto, updatedBy: string): Promise<StaffRow> {
    await this.getById(schema, id);

    return tenantTransaction(schema, async (client) => {
      // Update staff table
      const staffFields: string[] = [];
      const staffValues: unknown[] = [];
      let i = 1;

      const staffCols: (keyof UpdateStaffDto)[] = ['role', 'first_name', 'last_name', 'phone', 'dob', 'joining_date', 'qualifications'];
      for (const col of staffCols) {
        if (dto[col] !== undefined) {
          staffFields.push(`${col} = $${i++}`);
          staffValues.push(col === 'qualifications' ? JSON.stringify(dto[col]) : dto[col]);
        }
      }
      if (staffFields.length) {
        staffFields.push(`updated_at = now()`);
        staffValues.push(id);
        await client.query(
          `UPDATE ${schema}.staff SET ${staffFields.join(', ')} WHERE id = $${i}`,
          staffValues
        );
      }

      // Update staff_details
      const detailCols = ['employee_no','department','designation','salary','pay_frequency','bank_account','bank_ifsc','pan_no','aadhar_no','address'];
      const detailFields: string[] = [];
      const detailValues: unknown[] = [];
      let j = 1;
      for (const col of detailCols) {
        if ((dto as any)[col] !== undefined) {
          detailFields.push(`${col} = $${j++}`);
          detailValues.push((dto as any)[col]);
        }
      }
      if (dto.emergency_contact !== undefined) {
        detailFields.push(`emergency_contact = $${j++}`);
        detailValues.push(JSON.stringify(dto.emergency_contact));
      }
      if (detailFields.length) {
        detailValues.push(id);
        await client.query(
          `INSERT INTO ${schema}.staff_details (staff_id) VALUES ($${j})
           ON CONFLICT (staff_id) DO UPDATE SET ${detailFields.join(', ')}`,
          detailValues
        );
      }

      await cacheDel(`${schema}:staff:${id}`);
      await cacheDelPattern(`${schema}:staff:list:*`);
      return this.getById(schema, id);
    });
  }

  async setPassword(schema: string, id: string, newPassword: string): Promise<void> {
    const staff = await this.getById(schema, id);
    if (!staff) throw AppError.notFound('Staff member');
    const hash = await bcrypt.hash(newPassword, 12);
    await tenantQuery(schema,
      `UPDATE ${schema}.staff SET password_hash = $1, updated_at = now() WHERE id = $2`,
      [hash, id]
    );
  }

  async deactivate(schema: string, id: string): Promise<void> {
    const staff = await this.getById(schema, id);
    if (!staff.is_active) throw AppError.badRequest('Staff member is already inactive');
    await tenantQuery(
      schema,
      `UPDATE ${schema}.staff SET is_active = false, updated_at = now() WHERE id = $1`,
      [id]
    );
    await cacheDel(`${schema}:staff:${id}`);
    await cacheDelPattern(`${schema}:staff:list:*`);
  }

  // ── Leave management ──────────────────────────────────────────────────────

  async getLeaveBalance(schema: string, staffId: string, academicYear?: string): Promise<LeaveBalanceRow> {
    const year = academicYear ?? this.currentAcademicYear();
    const [row] = await tenantQuery<LeaveBalanceRow>(
      schema,
      `SELECT * FROM ${schema}.leave_balances WHERE staff_id = $1 AND academic_year = $2`,
      [staffId, year]
    );
    if (!row) throw AppError.notFound('Leave balance — ensure staff has been initialised for this academic year');
    return row;
  }

  async listLeaveRequests(schema: string, filters: LeaveFilters): Promise<PaginatedResponse<LeaveRequestRow>> {
    const { staff_id, status, leave_type, from, to, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (staff_id)   { conditions.push(`lr.staff_id = $${i++}`);    params.push(staff_id); }
    if (status)     { conditions.push(`lr.status = $${i++}`);      params.push(status); }
    if (leave_type) { conditions.push(`lr.leave_type = $${i++}`);  params.push(leave_type); }
    if (from)       { conditions.push(`lr.from_date >= $${i++}`);  params.push(from); }
    if (to)         { conditions.push(`lr.to_date <= $${i++}`);    params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total FROM ${schema}.leave_requests lr ${where}`,
      params
    );

    params.push(limit, offset);
    const rows = await tenantQuery<LeaveRequestRow>(
      schema,
      `SELECT lr.*,
              lr.from_date::text, lr.to_date::text,
              CONCAT(s.first_name, ' ', s.last_name)  AS staff_name,
              NULLIF(TRIM(CONCAT(r.first_name, ' ', r.last_name)), '') AS reviewer_name
       FROM   ${schema}.leave_requests lr
       JOIN   ${schema}.staff s ON s.id = lr.staff_id
       LEFT JOIN ${schema}.staff r ON r.id = lr.reviewed_by
       ${where}
       ORDER  BY lr.created_at DESC
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    return {
      data: rows,
      meta: { total: parseInt(countRow.total), page, limit, totalPages: Math.ceil(parseInt(countRow.total) / limit) },
    };
  }

  async requestLeave(schema: string, staffId: string, dto: RequestLeaveDto): Promise<LeaveRequestRow> {
    return tenantTransaction(schema, async (client) => {
      // Check for overlapping leave
      const { rows: [overlap] } = await client.query(
        `SELECT id FROM ${schema}.leave_requests
         WHERE staff_id = $1
           AND status NOT IN ('rejected','cancelled')
           AND NOT ($2 > to_date OR $3 < from_date)`,
        [staffId, dto.from_date, dto.to_date]
      );
      if (overlap) throw AppError.conflict('You already have a leave request overlapping these dates');

      // Calculate working days (Mon-Fri only, simple calc)
      const days = this.countWorkingDays(dto.from_date, dto.to_date);

      // Check balance for casual/sick/earned
      if (['casual', 'sick', 'earned'].includes(dto.leave_type)) {
        const year = this.currentAcademicYear();
        const { rows: [balance] } = await client.query(
          `SELECT * FROM ${schema}.leave_balances WHERE staff_id = $1 AND academic_year = $2`,
          [staffId, year]
        );
        if (balance) {
          const available = balance[dto.leave_type] - balance[`${dto.leave_type}_used`];
          if (days > available) {
            throw AppError.badRequest(`Insufficient ${dto.leave_type} leave balance. Available: ${available} days, Requested: ${days} days`);
          }
        }
      }

      const { rows } = await client.query(
        `INSERT INTO ${schema}.leave_requests
           (staff_id, leave_type, from_date, to_date, days, reason, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending')
         RETURNING *`,
        [staffId, dto.leave_type, dto.from_date, dto.to_date, days, dto.reason]
      );
      return rows[0] as LeaveRequestRow;
    });
  }

  async reviewLeave(schema: string, requestId: string, dto: ReviewLeaveDto, reviewerId: string): Promise<LeaveRequestRow> {
    const [request] = await tenantQuery<LeaveRequestRow>(
      schema, `SELECT * FROM ${schema}.leave_requests WHERE id = $1`, [requestId]
    );
    if (!request) throw AppError.notFound('Leave request');
    if (request.status !== 'pending') throw AppError.badRequest(`Cannot review a ${request.status} request`);

    return tenantTransaction(schema, async (client) => {
      const { rows } = await client.query(
        `UPDATE ${schema}.leave_requests
         SET status = $1, reviewed_by = $2, reviewed_at = now(), review_note = $3, updated_at = now()
         WHERE id = $4 RETURNING *`,
        [dto.status, reviewerId, dto.review_note ?? null, requestId]
      );

      // If approved — deduct from leave balance
      if (dto.status === 'approved' && ['casual','sick','earned'].includes(request.leave_type as string)) {
        const year = this.currentAcademicYear();
        const col = `${request.leave_type}_used`;
        await client.query(
          `UPDATE ${schema}.leave_balances
           SET ${col} = ${col} + $1, updated_at = now()
           WHERE staff_id = $2 AND academic_year = $3`,
          [request.days, request.staff_id, year]
        );
      }
      return rows[0] as LeaveRequestRow;
    });
  }

  async cancelLeave(schema: string, requestId: string, staffId: string): Promise<void> {
    const [request] = await tenantQuery<LeaveRequestRow>(
      schema, `SELECT * FROM ${schema}.leave_requests WHERE id = $1 AND staff_id = $2`, [requestId, staffId]
    );
    if (!request) throw AppError.notFound('Leave request');
    if (!['pending','approved'].includes(request.status as string)) {
      throw AppError.badRequest('Only pending or approved requests can be cancelled');
    }

    await tenantTransaction(schema, async (client) => {
      await client.query(
        `UPDATE ${schema}.leave_requests SET status = 'cancelled', updated_at = now() WHERE id = $1`,
        [requestId]
      );
      // If was approved — refund balance
      if (request.status === 'approved' && ['casual','sick','earned'].includes(request.leave_type as string)) {
        const col = `${request.leave_type}_used`;
        await client.query(
          `UPDATE ${schema}.leave_balances
           SET ${col} = GREATEST(0, ${col} - $1), updated_at = now()
           WHERE staff_id = $2 AND academic_year = $3`,
          [request.days, staffId, this.currentAcademicYear()]
        );
      }
    });
  }

  // ── Shift scheduling ──────────────────────────────────────────────────────

  async listShifts(schema: string, staffId?: string, from?: string, to?: string): Promise<ShiftRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (staffId) { conditions.push(`sh.staff_id = $${i++}`); params.push(staffId); }
    if (from)    { conditions.push(`sh.date >= $${i++}`);    params.push(from); }
    if (to)      { conditions.push(`sh.date <= $${i++}`);    params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return tenantQuery<ShiftRow>(
      schema,
      `SELECT sh.*, sh.date::text AS date,
              CONCAT(s.first_name, ' ', s.last_name) AS staff_name
       FROM   ${schema}.shifts sh
       JOIN   ${schema}.staff s ON s.id = sh.staff_id
       ${where}
       ORDER  BY sh.date, sh.start_time`,
      params
    );
  }

  async createShift(schema: string, dto: CreateShiftDto, createdBy: string): Promise<ShiftRow> {
    // Verify staff exists
    const [staff] = await tenantQuery(
      schema, `SELECT id FROM ${schema}.staff WHERE id = $1 AND is_active = true`, [dto.staff_id]
    );
    if (!staff) throw AppError.notFound('Staff member');

    // Check for shift conflict on same date
    const [conflict] = await tenantQuery(
      schema,
      `SELECT id FROM ${schema}.shifts WHERE staff_id = $1 AND date = $2 AND NOT ($3 >= end_time OR $4 <= start_time)`,
      [dto.staff_id, dto.date, dto.start_time, dto.end_time]
    );
    if (conflict) throw AppError.conflict('Shift conflicts with an existing shift for this staff member');

    const [row] = await tenantQuery<ShiftRow>(
      schema,
      `INSERT INTO ${schema}.shifts (staff_id, date, shift_type, start_time, end_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dto.staff_id, dto.date, dto.shift_type, dto.start_time, dto.end_time, dto.notes ?? null]
    );
    return row;
  }

  async deleteShift(schema: string, id: string): Promise<void> {
    const rows = await tenantQuery(
      schema, `DELETE FROM ${schema}.shifts WHERE id = $1 RETURNING id`, [id]
    );
    if (!rows.length) throw AppError.notFound('Shift');
  }

  // ── Payroll export ────────────────────────────────────────────────────────

  async generatePayrollExport(schema: string, filters: PayrollExportFilters): Promise<any[]> {
    const { month, year, role } = filters;
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to   = new Date(year, month, 0).toISOString().slice(0, 10);

    const roleFilter = role ? `AND s.role = '${role}'` : '';

    const rows = await tenantQuery<any>(
      schema,
      `SELECT
         s.id                                                              AS staff_id,
         sd.employee_no,
         s.first_name,
         s.last_name,
         s.email,
         s.role,
         sd.department,
         sd.designation,
         COALESCE(sd.salary, 0)::numeric(10,2)                            AS gross_salary,
         sd.pay_frequency,
         sd.bank_account,
         sd.bank_ifsc,
         sd.pan_no,
         -- Leave deductions
         COALESCE((
           SELECT SUM(lr.days) FROM ${schema}.leave_requests lr
           WHERE lr.staff_id = s.id
             AND lr.status = 'approved'
             AND lr.leave_type = 'lwp'
             AND lr.from_date BETWEEN $1 AND $2
         ), 0)::int                                                        AS lwp_days,
         -- Working days in month
         (SELECT COUNT(*) FROM generate_series($1::date, $2::date, '1 day')
          WHERE EXTRACT(DOW FROM generate_series) NOT IN (0,6))::int      AS working_days,
         -- Actual attendance
         (SELECT COUNT(*) FROM ${schema}.attendance a
          WHERE a.student_id IS NULL)::int                                 AS days_present,
         -- Net salary = gross - LWP deduction
         ROUND(
           COALESCE(sd.salary, 0)
           - (COALESCE(sd.salary, 0) / NULLIF(
               (SELECT COUNT(*) FROM generate_series($1::date, $2::date, '1 day')
                WHERE EXTRACT(DOW FROM generate_series) NOT IN (0,6)), 0
             )) * COALESCE((
               SELECT SUM(lr.days) FROM ${schema}.leave_requests lr
               WHERE lr.staff_id = s.id AND lr.status = 'approved'
                 AND lr.leave_type = 'lwp' AND lr.from_date BETWEEN $1 AND $2
             ), 0),
           2
         )::numeric(10,2)                                                  AS net_salary
       FROM   ${schema}.staff s
       LEFT JOIN ${schema}.staff_details sd ON sd.staff_id = s.id
       WHERE  s.is_active = true ${roleFilter}
       ORDER  BY s.role, s.first_name, s.last_name`,
      [from, to]
    );

    return rows;
  }

  // ── CSV formatter ─────────────────────────────────────────────────────────

  formatPayrollCsv(rows: any[], month: number, year: number): string {
    const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' });
    const header = [
      'Employee No', 'First Name', 'Last Name', 'Email', 'Role', 'Department',
      'Designation', 'Gross Salary', 'LWP Days', 'Working Days',
      'Net Salary', 'Bank Account', 'IFSC Code', 'PAN',
    ].join(',');

    const csvRows = rows.map(r => [
      r.employee_no ?? '', r.first_name, r.last_name, r.email,
      r.role, r.department ?? '', r.designation ?? '',
      r.gross_salary, r.lwp_days, r.working_days,
      r.net_salary, r.bank_account ?? '', r.bank_ifsc ?? '', r.pan_no ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    return [`# Payroll Report — ${monthName} ${year}`, header, ...csvRows].join('\n');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async initLeaveBalance(schema: string, staffId: string, client: any): Promise<void> {
    const year = this.currentAcademicYear();
    await client.query(
      `INSERT INTO ${schema}.leave_balances
         (staff_id, academic_year, casual, sick, earned)
       VALUES ($1, $2, 12, 12, 15)
       ON CONFLICT (staff_id, academic_year) DO NOTHING`,
      [staffId, year]
    );
  }

  private currentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 6
      ? `${year}-${year + 1}`
      : `${year - 1}-${year}`;
  }

  private countWorkingDays(from: string, to: string): number {
    const start = new Date(from);
    const end   = new Date(to);
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }
}

export const staffService = new StaffService();
