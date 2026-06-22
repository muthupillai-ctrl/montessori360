import { Request, Response } from 'express';
import { feesService } from './fees.service.js';
import { concessionsService } from './concessions.service.js';
import type {
  CreateFeeStructureDto, CreateInvoiceDto, BulkCreateInvoicesDto,
  RecordPaymentDto, WaiveInvoiceDto, InvoiceFilters, DefaulterFilters,
} from './fees.types.js';

// ── Fee structures ────────────────────────────────────────────────────────────

export async function listFeeStructures(req: Request, res: Response): Promise<void> {
  const rows = await feesService.listFeeStructures(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function getFeeStructure(req: Request, res: Response): Promise<void> {
  const row = await feesService.getFeeStructure(req.user!.tenantSchema, String(req.params.id));
  res.json({ data: row });
}

export async function createFeeStructure(req: Request, res: Response): Promise<void> {
  const row = await feesService.createFeeStructure(
    req.user!.tenantSchema, req.body as CreateFeeStructureDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Fee structure created successfully' });
}

export async function updateFeeStructure(req: Request, res: Response): Promise<void> {
  const row = await feesService.updateFeeStructure(
    req.user!.tenantSchema, String(req.params.id), req.body, req.user!.sub
  );
  res.json({ data: row, message: 'Fee structure updated successfully' });
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function deleteFeeStructure(req: Request, res: Response): Promise<void> {
  try {
    await feesService.deleteFeeStructure(
      req.user!.tenantSchema,
      req.params['id'] as string,
      req.user!.sub
    );
    res.json({ message: 'Fee structure deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as InvoiceFilters;
  const result = await feesService.listInvoices(req.user!.tenantSchema, filters);
  res.json(result);
}

export async function getInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await feesService.getInvoice(req.user!.tenantSchema, String(req.params.id));
  res.json({ data: invoice });
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await feesService.createInvoice(
    req.user!.tenantSchema, req.body as CreateInvoiceDto, req.user!.sub
  );
  res.status(201).json({ data: invoice, message: 'Invoice created successfully' });
}

export async function bulkCreateInvoices(req: Request, res: Response): Promise<void> {
  try {
    const count = await feesService.bulkCreateInvoices(
      req.user!.tenantSchema, req.body as BulkCreateInvoicesDto, req.user!.sub
    );
    res.status(201).json({
      message: `${count} invoice(s) created successfully`,
      data: { count },
    });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function recordPayment(req: Request, res: Response): Promise<void> {
  const invoice = await feesService.recordPayment(
    req.user!.tenantSchema, String(req.params.id), req.body as RecordPaymentDto, req.user!.sub
  );
  res.json({ data: invoice, message: 'Payment recorded successfully' });
}

export async function waiveInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await feesService.waiveInvoice(
    req.user!.tenantSchema, String(req.params.id), req.body as WaiveInvoiceDto, req.user!.sub
  );
  res.json({ data: invoice, message: 'Invoice waived successfully' });
}

export async function markOverdue(req: Request, res: Response): Promise<void> {
  const count = await feesService.markOverdue(req.user!.tenantSchema);
  res.json({ message: `${count} invoice(s) marked as overdue`, data: { count } });
}

// ── Reporting ─────────────────────────────────────────────────────────────────

export async function getDefaulters(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as DefaulterFilters;
  const rows = await feesService.getDefaulters(req.user!.tenantSchema, filters);
  res.json({ data: rows });
}

export async function getCollectionSummary(req: Request, res: Response): Promise<void> {
  const { from, to } = req.query as { from?: string; to?: string };
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const summary = await feesService.collectionSummary(
    req.user!.tenantSchema,
    from ?? firstOfMonth,
    to ?? today
  );
  res.json({ data: summary });
}

export async function deleteInvoice(req: Request, res: Response): Promise<void> {
  try {
    await feesService.deleteInvoice(req.user!.tenantSchema, String(req.params['id']));
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

// ── Concessions ───────────────────────────────────────────────────────────────

export async function listConcessions(req: Request, res: Response): Promise<void> {
  const rows = await concessionsService.list(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function createConcession(req: Request, res: Response): Promise<void> {
  const row = await concessionsService.create(req.user!.tenantSchema, req.body);
  res.status(201).json({ data: row, message: 'Concession created' });
}

export async function updateConcession(req: Request, res: Response): Promise<void> {
  const row = await concessionsService.update(req.user!.tenantSchema, String(req.params['id']), req.body);
  res.json({ data: row, message: 'Concession updated' });
}

export async function deleteConcession(req: Request, res: Response): Promise<void> {
  await concessionsService.remove(req.user!.tenantSchema, String(req.params['id']));
  res.json({ message: 'Concession deleted' });
}

export async function listAssignments(req: Request, res: Response): Promise<void> {
  const rows = await concessionsService.listAssignments(req.user!.tenantSchema, {
    student_id:    req.query['student_id']    as string,
    concession_id: req.query['concession_id'] as string,
    academic_year: req.query['academic_year'] as string,
  });
  res.json({ data: rows });
}

export async function assignConcession(req: Request, res: Response): Promise<void> {
  const row = await concessionsService.assign(req.user!.tenantSchema, req.body);
  res.status(201).json({ data: row, message: 'Concession assigned' });
}

export async function removeAssignment(req: Request, res: Response): Promise<void> {
  await concessionsService.removeAssignment(req.user!.tenantSchema, String(req.params['id']));
  res.json({ message: 'Assignment removed' });
}

export async function listSiblingGroups(req: Request, res: Response): Promise<void> {
  const groups = await concessionsService.listSiblingGroups(req.user!.tenantSchema);
  res.json({ data: groups });
}

export async function bulkSiblingDiscount(req: Request, res: Response): Promise<void> {
  const result = await concessionsService.bulkAssignSiblingDiscount(req.user!.tenantSchema, {
    ...req.body,
    approved_by: req.user!.sub,
  });
  res.json({ data: result, message: `${result.assigned} student(s) assigned, ${result.skipped} skipped` });
}
