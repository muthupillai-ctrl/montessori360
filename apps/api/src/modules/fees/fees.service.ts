import { PoolClient } from 'pg';
import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  FeeStructureRow, FeeInvoiceRow,
  CreateFeeStructureDto, CreateInvoiceDto, BulkCreateInvoicesDto,
  RecordPaymentDto, WaiveInvoiceDto,
  InvoiceFilters, DefaulterFilters,
} from './fees.types.js';
import type { PaginatedResponse } from '@montessori360/shared';

const CACHE_TTL = 300;

class FeesService {

  // ── Invoice number generator ──────────────────────────────────────────────
  private async nextInvoiceNo(schema: string, client: PoolClient): Promise<string> {
    const year  = new Date().getFullYear().toString().slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV${year}${month}`;

    // Lock the table row to prevent concurrent duplicates, then get max existing number
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no FROM ${prefix.length + 1}) AS INTEGER)), 0) AS max_seq
       FROM ${schema}.fee_invoices
       WHERE invoice_no LIKE $1`,
      [`${prefix}%`]
    );
    const seq = String(parseInt(rows[0].max_seq) + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  // ── Fee structures ────────────────────────────────────────────────────────

  async listFeeStructures(schema: string): Promise<FeeStructureRow[]> {
    const cacheKey = `${schema}:fee_structures`;
    const cached = await cacheGet<FeeStructureRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<FeeStructureRow>(
      schema,
      `SELECT * FROM ${schema}.fee_structures WHERE is_active = true ORDER BY academic_year DESC, name`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async getFeeStructure(schema: string, id: string): Promise<FeeStructureRow> {
    const [row] = await tenantQuery<FeeStructureRow>(
      schema,
      `SELECT * FROM ${schema}.fee_structures WHERE id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('Fee structure');
    return row;
  }

  async createFeeStructure(schema: string, dto: CreateFeeStructureDto, createdBy: string): Promise<FeeStructureRow> {
    return tenantTransaction(schema, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO ${schema}.fee_structures
           (name, academic_year, billing_cycle, heads, applies_to, class_ids)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          dto.name, dto.academic_year, dto.billing_cycle,
          JSON.stringify(dto.heads),
          dto.applies_to ?? 'all',
          dto.class_ids ?? [],
        ]
      );
      await this.auditLog(schema, client, createdBy, 'CREATE', 'fee_structures', rows[0].id);
      await cacheDel(`${schema}:fee_structures`);
      return rows[0] as FeeStructureRow;
    });
  }

  async updateFeeStructure(schema: string, id: string, dto: Partial<CreateFeeStructureDto>, updatedBy: string): Promise<FeeStructureRow> {
    await this.getFeeStructure(schema, id); // ensure exists

    return tenantTransaction(schema, async (client) => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (dto.name          !== undefined) { fields.push(`name = $${i++}`);          values.push(dto.name); }
      if (dto.billing_cycle !== undefined) { fields.push(`billing_cycle = $${i++}`); values.push(dto.billing_cycle); }
      if (dto.heads         !== undefined) { fields.push(`heads = $${i++}`);         values.push(JSON.stringify(dto.heads)); }
      if (dto.applies_to    !== undefined) { fields.push(`applies_to = $${i++}`);    values.push(dto.applies_to); }
      if (dto.class_ids     !== undefined) { fields.push(`class_ids = $${i++}`);     values.push(dto.class_ids); }

      if (!fields.length) throw AppError.badRequest('No fields to update');
      fields.push(`updated_at = now()`);
      values.push(id);

      const { rows } = await client.query(
        `UPDATE ${schema}.fee_structures SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );
      await this.auditLog(schema, client, updatedBy, 'UPDATE', 'fee_structures', id);
      await cacheDel(`${schema}:fee_structures`);
      return rows[0] as FeeStructureRow;
    });
  }

  async deleteFeeStructure(schema: string, id: string, deletedBy: string): Promise<void> {
    await this.getFeeStructure(schema, id); // ensure exists

    // Check if any invoices reference this structure
    const [usage] = await tenantQuery<{ count: string }>(
      schema,
      `SELECT COUNT(*)::int AS count FROM ${schema}.fee_invoices WHERE fee_structure_id = $1`,
      [id]
    );
    if (parseInt(usage.count) > 0) {
      throw AppError.badRequest(`Cannot delete — ${usage.count} invoice(s) reference this structure. Deactivate it instead.`);
    }

    await tenantTransaction(schema, async (client) => {
      await client.query(
        `DELETE FROM ${schema}.fee_structures WHERE id = $1`,
        [id]
      );
      await this.auditLog(schema, client, deletedBy, 'DELETE', 'fee_structures', id);
    });
    await cacheDel(`${schema}:fee_structures`);
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  async listInvoices(schema: string, filters: InvoiceFilters): Promise<PaginatedResponse<FeeInvoiceRow>> {
    const { student_id, class_id, status, due_date_from, due_date_to, billing_period, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (student_id)    { conditions.push(`i.student_id = $${i++}`);          params.push(student_id); }
    if (status)        { conditions.push(`i.status = $${i++}`);              params.push(status); }
    if (billing_period){ conditions.push(`i.billing_period = $${i++}`);      params.push(billing_period); }
    if (due_date_from) { conditions.push(`i.due_date >= $${i++}`);           params.push(due_date_from); }
    if (due_date_to)   { conditions.push(`i.due_date <= $${i++}`);           params.push(due_date_to); }
    if (class_id)      { conditions.push(`s.class_id = $${i++}`);            params.push(class_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total
       FROM ${schema}.fee_invoices i
       JOIN ${schema}.students s ON s.id = i.student_id
       ${where}`,
      params
    );

    params.push(limit, offset);
    const rows = await tenantQuery<FeeInvoiceRow>(
      schema,
      `SELECT i.*,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.admission_no,
              c.name AS class_name
       FROM   ${schema}.fee_invoices i
       JOIN   ${schema}.students s ON s.id = i.student_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       ${where}
       ORDER  BY i.due_date DESC, i.created_at DESC
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    return {
      data: rows,
      meta: {
        total: parseInt(countRow.total),
        page, limit,
        totalPages: Math.ceil(parseInt(countRow.total) / limit),
      },
    };
  }

  async getInvoice(schema: string, id: string): Promise<FeeInvoiceRow> {
    const [row] = await tenantQuery<FeeInvoiceRow>(
      schema,
      `SELECT i.*,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.admission_no,
              c.name AS class_name
       FROM   ${schema}.fee_invoices i
       JOIN   ${schema}.students s ON s.id = i.student_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       WHERE  i.id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('Invoice');
    return row;
  }

  async createInvoice(schema: string, dto: CreateInvoiceDto, createdBy: string): Promise<FeeInvoiceRow> {
    return tenantTransaction(schema, async (client) => {

      // Verify student
      const { rows: [student] } = await client.query(
        `SELECT id FROM ${schema}.students WHERE id = $1 AND is_active = true`,
        [dto.student_id]
      );
      if (!student) throw AppError.notFound('Student');

      // Determine invoice type
      const invoiceType = dto.invoice_type ?? (
        dto.fee_structure_id ? 'fee_structure' : 'adhoc'
      );

      // Duplicate check per type
      if (invoiceType === 'fee_structure' && dto.fee_structure_id) {
        const { rows: [dup] } = await client.query(
          `SELECT invoice_no FROM ${schema}.fee_invoices
           WHERE student_id = $1 AND billing_period = $2
             AND fee_structure_id = $3 AND status != 'waived' LIMIT 1`,
          [dto.student_id, dto.billing_period, dto.fee_structure_id]
        );
        if (dup) throw AppError.conflict(
          `Invoice ${dup.invoice_no} already exists for this student, period and fee structure`
        );
      }

      if (invoiceType === 'transport') {
        const { rows: [dup] } = await client.query(
          `SELECT invoice_no FROM ${schema}.fee_invoices
           WHERE student_id = $1 AND billing_period = $2
             AND invoice_type = 'transport' AND status != 'waived' LIMIT 1`,
          [dto.student_id, dto.billing_period]
        );
        if (dup) throw AppError.conflict(
          `Transport invoice ${dup.invoice_no} already exists for this student and period`
        );
      }

      // Auto-add transport fee only if not already invoiced for this period
      const lineItems = [...dto.line_items];
      const hasTransport = lineItems.some(i => i.name === 'Transport Fee');
      if (!hasTransport) {
        try {
          // Check if a transport invoice already exists for this student + period
          const { rows: [existingTransport] } = await client.query(
            `SELECT id FROM ${schema}.fee_invoices
             WHERE student_id = $1 AND billing_period = $2
               AND invoice_type = 'transport' AND status != 'waived' LIMIT 1`,
            [dto.student_id, dto.billing_period]
          );

          if (!existingTransport) {
            const { rows: [rt] } = await client.query(
              `SELECT r.monthly_fee FROM ${schema}.route_students rs
               JOIN ${schema}.transport_routes r ON r.id = rs.route_id
               WHERE rs.student_id = $1 AND rs.is_active = true
                 AND r.monthly_fee IS NOT NULL LIMIT 1`,
              [dto.student_id]
            );
            if (rt?.monthly_fee > 0) {
              lineItems.push({ name: 'Transport Fee', amount: +rt.monthly_fee });
            }
          }
        } catch (_) { /* no transport assigned */ }
      }

      const invoiceNo = await this.nextInvoiceNo(schema, client);
      const subtotal  = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const discount  = dto.discount ?? 0;
      const tax       = dto.tax ?? 0;
      const total     = subtotal - discount + tax;

      const { rows } = await client.query(
        `INSERT INTO ${schema}.fee_invoices
           (invoice_no, student_id, fee_structure_id, invoice_type, billing_period,
            line_items, subtotal, discount, tax, total, due_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          invoiceNo, dto.student_id, dto.fee_structure_id ?? null,
          invoiceType, dto.billing_period, JSON.stringify(lineItems),
          subtotal, discount, tax, total, dto.due_date, createdBy,
        ]
      );

      await this.auditLog(schema, client, createdBy, 'CREATE', 'fee_invoices', rows[0].id);
      return rows[0] as FeeInvoiceRow;
    });
  }

  async bulkCreateInvoices(schema: string, dto: BulkCreateInvoicesDto, createdBy: string): Promise<number> {
    // Load fee structure
    const structure = await this.getFeeStructure(schema, dto.fee_structure_id);

    // Get students to invoice
    const classFilter = dto.class_id ? `AND class_id = '${dto.class_id}'` : '';
    const students = await tenantQuery<{ id: string }>(
      schema,
      `SELECT id FROM ${schema}.students WHERE is_active = true ${classFilter}`
    );
    if (!students.length) throw AppError.badRequest('No active students found for bulk invoice');

    // Skip students who already have an invoice for this structure + billing_period combination
    const existingRows = await tenantQuery<{ student_id: string }>(
      schema,
      `SELECT student_id FROM ${schema}.fee_invoices
       WHERE billing_period = $1 AND fee_structure_id = $2`,
      [dto.billing_period, dto.fee_structure_id]
    );
    const alreadyInvoiced = new Set(existingRows.map(r => r.student_id));

    const toInvoice = students.filter(s => !alreadyInvoiced.has(s.id));
    if (!toInvoice.length) {
      throw AppError.conflict(`All students already have an invoice for "${dto.billing_period}" with this fee structure. No new invoices created.`);
    }

    // Build line items from structure heads (non-optional only for bulk)
    const baseLineItems = structure.heads
      .filter(h => !h.is_optional)
      .map(h => ({ name: h.name, amount: h.amount }));

    const discount = dto.discount ?? 0;

    // Fetch transport fees from route assignments
    let transportFeeMap = new Map<string, number>();
    try {
      const transportFeeRows = await tenantQuery<{ student_id: string; monthly_fee: number }>(
        schema,
        `SELECT rs.student_id, r.monthly_fee
         FROM ${schema}.route_students rs
         JOIN ${schema}.transport_routes r ON r.id = rs.route_id
         WHERE rs.student_id = ANY($1::uuid[])
           AND rs.is_active = true
           AND r.monthly_fee IS NOT NULL`,
        [toInvoice.map(s => s.id)]
      );
      transportFeeMap = new Map(transportFeeRows.map(r => [r.student_id, +r.monthly_fee]));
    } catch (_) { /* no transport assigned, skip */ }

    return tenantTransaction(schema, async (client) => {
      let count = 0;
      for (const student of toInvoice) {
        const invoiceNo  = await this.nextInvoiceNo(schema, client);
        // Add transport fee line item if student has one
        const lineItems  = [...baseLineItems];
        const transportFee = transportFeeMap.get(student.id);
        if (transportFee && transportFee > 0) {
          lineItems.push({ name: 'Transport Fee', amount: transportFee });
        }
        const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
        const total    = subtotal - discount;
        await client.query(
          `INSERT INTO ${schema}.fee_invoices
             (invoice_no, student_id, fee_structure_id, billing_period,
              line_items, subtotal, discount, tax, total, due_date, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            invoiceNo, student.id, dto.fee_structure_id,
            dto.billing_period, JSON.stringify(lineItems),
            subtotal, discount, 0, total, dto.due_date, createdBy,
          ]
        );
        count++;
      }
      await this.auditLog(schema, client, createdBy, 'BULK_CREATE', 'fee_invoices', null);
      return count;
    });
  }

  // ── Payment recording ─────────────────────────────────────────────────────

  async recordPayment(schema: string, invoiceId: string, dto: RecordPaymentDto, recordedBy: string): Promise<FeeInvoiceRow> {
    const invoice = await this.getInvoice(schema, invoiceId);

    if (invoice.status === 'paid')   throw AppError.conflict('Invoice is already fully paid');
    if (invoice.status === 'waived') throw AppError.conflict('Invoice has been waived');

    const newPaidAmount = Number(invoice.paid_amount) + dto.amount;
    if (newPaidAmount > Number(invoice.total)) {
      throw AppError.badRequest(
        `Payment of ₹${dto.amount} exceeds outstanding balance of ₹${Number(invoice.total) - Number(invoice.paid_amount)}`
      );
    }

    const newStatus = newPaidAmount >= Number(invoice.total) ? 'paid' : 'partial';

    return tenantTransaction(schema, async (client) => {
      const { rows } = await client.query(
        `UPDATE ${schema}.fee_invoices
         SET paid_amount    = $1,
             status         = $2::varchar,
             payment_method = $3,
             paid_at        = CASE WHEN $2::varchar = 'paid' THEN now() ELSE paid_at END,
             updated_at     = now()
         WHERE id = $4
         RETURNING *`,
        [newPaidAmount, newStatus, dto.method, invoiceId]
      );

      // Record payment detail in audit log with full payment info
      await client.query(
        `INSERT INTO ${schema}.audit_logs
           (actor_id, actor_type, action, entity, entity_id, delta)
         VALUES ($1, 'staff', 'PAYMENT', 'fee_invoices', $2, $3)`,
        [
          recordedBy, invoiceId,
          JSON.stringify({
            amount:               dto.amount,
            method:               dto.method,
            reference_no:         dto.reference_no,
            razorpay_payment_id:  dto.razorpay_payment_id,
            notes:                dto.notes,
            new_paid_amount:      newPaidAmount,
            new_status:           newStatus,
          }),
        ]
      );

      await cacheDelPattern(`${schema}:invoices:*`);
      return rows[0] as FeeInvoiceRow;
    });
  }

  // ── Waive invoice ─────────────────────────────────────────────────────────

  async waiveInvoice(schema: string, invoiceId: string, dto: WaiveInvoiceDto, updatedBy: string): Promise<FeeInvoiceRow> {
    const invoice = await this.getInvoice(schema, invoiceId);
    if (invoice.status === 'paid')   throw AppError.conflict('Cannot waive a paid invoice');
    if (invoice.status === 'waived') throw AppError.conflict('Invoice is already waived');

    return tenantTransaction(schema, async (client) => {
      const { rows } = await client.query(
        `UPDATE ${schema}.fee_invoices
         SET status = 'waived', updated_at = now()
         WHERE id = $1 RETURNING *`,
        [invoiceId]
      );
      await this.auditLog(schema, client, updatedBy, 'WAIVE', 'fee_invoices', invoiceId, { reason: dto.reason });
      return rows[0] as FeeInvoiceRow;
    });
  }

  // ── Mark overdue ──────────────────────────────────────────────────────────
  // Called by a scheduled job or manually by admin
  async markOverdue(schema: string): Promise<number> {
    const rows = await tenantQuery<{ id: string }>(
      schema,
      `UPDATE ${schema}.fee_invoices
       SET status = 'overdue', updated_at = now()
       WHERE status IN ('pending', 'partial')
         AND due_date < CURRENT_DATE
       RETURNING id`
    );
    await cacheDelPattern(`${schema}:invoices:*`);
    return rows.length;
  }

  // ── Defaulters ────────────────────────────────────────────────────────────

  async getDefaulters(schema: string, filters: DefaulterFilters): Promise<any[]> {
    const classFilter = filters.class_id ? `AND s.class_id = '${filters.class_id}'` : '';

    return tenantQuery(
      schema,
      `SELECT
         s.id                                          AS student_id,
         CONCAT(s.first_name, ' ', s.last_name)        AS student_name,
         s.admission_no,
         COALESCE(c.name, 'Unassigned')                AS class_name,
         COUNT(i.id)::int                              AS invoice_count,
         SUM(i.total - i.paid_amount)::numeric(10,2)   AS total_outstanding,
         MIN(i.due_date)::text                         AS oldest_due_date,
         MAX(CURRENT_DATE - i.due_date)::int           AS max_overdue_days
       FROM   ${schema}.students s
       JOIN   ${schema}.fee_invoices i ON i.student_id = s.id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       WHERE  i.status IN ('pending', 'partial', 'overdue')
         AND  s.is_active = true
         ${classFilter}
       GROUP  BY s.id, s.first_name, s.last_name, s.admission_no, c.name
       ORDER  BY total_outstanding DESC`
    );
  }

  // ── Collection summary ────────────────────────────────────────────────────

  async collectionSummary(schema: string, from: string, to: string): Promise<any> {
    const [summary] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*)::int                                              AS total_invoices,
         COUNT(*) FILTER (WHERE status = 'paid')::int              AS paid,
         COUNT(*) FILTER (WHERE status = 'partial')::int           AS partial,
         COUNT(*) FILTER (WHERE status = 'pending')::int           AS pending,
         COUNT(*) FILTER (WHERE status = 'overdue')::int           AS overdue,
         COUNT(*) FILTER (WHERE status = 'waived')::int            AS waived,
         COALESCE(SUM(total), 0)::numeric(12,2)                    AS total_billed,
         COALESCE(SUM(paid_amount), 0)::numeric(12,2)              AS total_collected,
         COALESCE(SUM(total - paid_amount)
           FILTER (WHERE status NOT IN ('paid','waived')), 0)
           ::numeric(12,2)                                         AS total_outstanding
       FROM ${schema}.fee_invoices
       WHERE created_at::date BETWEEN $1 AND $2`,
      [from, to]
    );
    return { ...summary, from, to };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async auditLog(
    schema: string, client: PoolClient,
    actorId: string, action: string,
    entity: string, entityId: string | null,
    extra?: Record<string, unknown>
  ): Promise<void> {
    await client.query(
      `INSERT INTO ${schema}.audit_logs (actor_id, actor_type, action, entity, entity_id, delta)
       VALUES ($1, 'staff', $2, $3, $4, $5)`,
      [actorId, action, entity, entityId, JSON.stringify(extra ?? {})]
    );
  }
  async deleteInvoice(schema: string, invoiceId: string): Promise<void> {
    const [invoice] = await tenantQuery<any>(
      schema,
      `SELECT id, status FROM ${schema}.fee_invoices WHERE id = $1`,
      [invoiceId]
    );
    if (!invoice) throw AppError.notFound('Invoice');
    if (invoice.status === 'paid') throw AppError.badRequest('Cannot delete a paid invoice. Waive it instead.');

    await tenantQuery(
      schema,
      `DELETE FROM ${schema}.fee_invoices WHERE id = $1`,
      [invoiceId]
    );
    await cacheDelPattern(`${schema}:invoices:*`);
  }
}

export const feesService = new FeesService();
