import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateFeeStructure, validateCreateInvoice, validateBulkCreateInvoices,
  validateRecordPayment, validateWaiveInvoice,
  validateInvoiceFilters, validateDefaulterFilters,
} from './fees.validators.js';
import {
  listFeeStructures, getFeeStructure, createFeeStructure, updateFeeStructure, deleteFeeStructure,
  listInvoices, getInvoice, createInvoice, bulkCreateInvoices,
  recordPayment, waiveInvoice, markOverdue, deleteInvoice,
  getDefaulters, getCollectionSummary,
  listConcessions, createConcession, updateConcession, deleteConcession,
  listAssignments, assignConcession, removeAssignment,
  listSiblingGroups, bulkSiblingDiscount,
} from './fees.controller.js';

export const feesRouter = Router();
feesRouter.use(authenticate);

const MANAGE_ROLES  = ['owner', 'principal', 'accountant'];
const VIEW_ROLES    = ['owner', 'principal', 'accountant', 'teacher'];
const PARENT_ROLES  = ['owner', 'principal', 'accountant', 'parent'];

// ── Fee structures ────────────────────────────────────────────────────────────
feesRouter.get( '/structures',          authorize(...VIEW_ROLES),   listFeeStructures);
feesRouter.post('/structures',          authorize(...MANAGE_ROLES), validateCreateFeeStructure, createFeeStructure);
feesRouter.get( '/structures/:id',      authorize(...VIEW_ROLES),   getFeeStructure);
feesRouter.put(    '/structures/:id',    authorize(...MANAGE_ROLES), updateFeeStructure);
feesRouter.delete( '/structures/:id',    authorize(...MANAGE_ROLES), deleteFeeStructure);

// ── Invoices ──────────────────────────────────────────────────────────────────
feesRouter.get( '/invoices',            authorize(...PARENT_ROLES), validateInvoiceFilters,     listInvoices);
feesRouter.post('/invoices',            authorize(...MANAGE_ROLES), validateCreateInvoice,      createInvoice);
feesRouter.post('/invoices/bulk',       authorize(...MANAGE_ROLES), validateBulkCreateInvoices, bulkCreateInvoices);
feesRouter.get( '/invoices/:id',        authorize(...PARENT_ROLES), getInvoice);
feesRouter.post('/invoices/:id/pay',    authorize(...MANAGE_ROLES), validateRecordPayment,      recordPayment);
feesRouter.post('/invoices/:id/waive',  authorize('owner', 'principal'), validateWaiveInvoice,  waiveInvoice);
feesRouter.delete('/invoices/:id',          authorize('owner', 'principal', 'accountant'), deleteInvoice);
feesRouter.post('/invoices/mark-overdue', authorize('owner', 'principal', 'accountant'),        markOverdue);

// ── Reporting ─────────────────────────────────────────────────────────────────
feesRouter.get( '/defaulters',          authorize(...MANAGE_ROLES), validateDefaulterFilters,   getDefaulters);
feesRouter.get( '/collection-summary',  authorize(...MANAGE_ROLES),                             getCollectionSummary);

// ── Concessions ───────────────────────────────────────────────────────────────
feesRouter.get(   '/concessions',                     authorize(...VIEW_ROLES),   listConcessions);
feesRouter.post(  '/concessions',                     authorize(...MANAGE_ROLES), createConcession);
feesRouter.put(   '/concessions/:id',                 authorize(...MANAGE_ROLES), updateConcession);
feesRouter.delete('/concessions/:id',                 authorize(...MANAGE_ROLES), deleteConcession);

feesRouter.get(   '/concessions/assignments',         authorize(...MANAGE_ROLES), listAssignments);
feesRouter.post(  '/concessions/assignments',         authorize(...MANAGE_ROLES), assignConcession);
feesRouter.delete('/concessions/assignments/:id',     authorize(...MANAGE_ROLES), removeAssignment);

feesRouter.get(   '/concessions/siblings',            authorize(...MANAGE_ROLES), listSiblingGroups);
feesRouter.post(  '/concessions/siblings/bulk-assign',authorize(...MANAGE_ROLES), bulkSiblingDiscount);
