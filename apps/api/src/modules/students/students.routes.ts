import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateStudent, validateUpdateStudent,
  validateStudentFilters, validateStudentId,
  validateAssignClass, validateLinkSiblings,
} from './students.validators.js';
import {
  listStudents, getStudent, createStudent, updateStudent, deactivateStudent,
  assignClass, getSiblings, linkSiblings, unlinkSiblings,
  promoteStudents, listClasses, createClass, updateClass, deleteClass,
  listParents, createParent, updateParent, deleteParent, inviteParentToPortal,
  listAllParents, listPortalAccounts, inviteParentByRecord,
  resendParentInvite, togglePortalAccount, deletePortalAccount,
  assignRfid,
} from './students.controller.js';

export const studentsRouter = Router();
studentsRouter.use(authenticate);

const ADMIN_ROLES  = ['owner', 'principal'];
const VIEW_ROLES   = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'admission_staff', 'rfid_admin'];
const MANAGE_ROLES = ['owner', 'principal', 'admission_staff'];

// ── Classes ───────────────────────────────────────────────────────────────────
studentsRouter.get( '/classes', authorize(...VIEW_ROLES),  listClasses);
studentsRouter.post(  '/classes',           authorize(...ADMIN_ROLES), createClass);
studentsRouter.put(   '/classes/:classId',   authorize(...ADMIN_ROLES), updateClass);
studentsRouter.delete('/classes/:classId',   authorize(...ADMIN_ROLES), deleteClass);

// ── Parent directory (global) — must be before /:id ──────────────────────────
studentsRouter.get(  '/all-parents',                            authorize(...VIEW_ROLES),   listAllParents);
studentsRouter.get(  '/portal-accounts',                        authorize(...MANAGE_ROLES), listPortalAccounts);
studentsRouter.post( '/all-parents/:parentRecordId/invite',     authorize(...MANAGE_ROLES), inviteParentByRecord);
studentsRouter.post( '/portal-accounts/:accountId/resend',      authorize(...MANAGE_ROLES), resendParentInvite);
studentsRouter.patch( '/portal-accounts/:accountId/toggle',      authorize(...MANAGE_ROLES), togglePortalAccount);
studentsRouter.delete('/portal-accounts/:accountId',             authorize(...MANAGE_ROLES), deletePortalAccount);

// ── Students CRUD ─────────────────────────────────────────────────────────────
studentsRouter.get('/',    authorize(...VIEW_ROLES),   validateStudentFilters, listStudents);
studentsRouter.post('/',   authorize(...MANAGE_ROLES), validateCreateStudent,  createStudent);
studentsRouter.get('/:id', authorize(...VIEW_ROLES),   validateStudentId,      getStudent);
studentsRouter.put('/:id', authorize(...MANAGE_ROLES), validateStudentId, validateUpdateStudent, updateStudent);
studentsRouter.delete('/:id', authorize(...MANAGE_ROLES), validateStudentId, deactivateStudent);

// ── Class assignment ──────────────────────────────────────────────────────────
studentsRouter.patch('/:id/class', authorize(...MANAGE_ROLES), validateStudentId, validateAssignClass, assignClass);

// ── RFID card assignment (rfid_admin only) ────────────────────────────────────
studentsRouter.patch('/:id/rfid', authorize('rfid_admin', ...MANAGE_ROLES), validateStudentId, assignRfid);

// ── Siblings ──────────────────────────────────────────────────────────────────
studentsRouter.get('/:id/siblings',    authorize(...VIEW_ROLES),   validateStudentId,    getSiblings);
studentsRouter.post('/siblings/link',  authorize(...MANAGE_ROLES), validateLinkSiblings, linkSiblings);
studentsRouter.post('/siblings/unlink',authorize(...MANAGE_ROLES), validateLinkSiblings, unlinkSiblings);

// ── Parents per student ───────────────────────────────────────────────────────
studentsRouter.get(   '/:studentId/parents',                  authorize(...VIEW_ROLES),   listParents);
studentsRouter.post(  '/:studentId/parents',                  authorize(...MANAGE_ROLES), createParent);
studentsRouter.put(   '/:studentId/parents/:parentId',        authorize(...MANAGE_ROLES), updateParent);
studentsRouter.delete('/:studentId/parents/:parentId',        authorize(...MANAGE_ROLES), deleteParent);
studentsRouter.post(  '/:studentId/parents/invite',           authorize(...MANAGE_ROLES), inviteParentToPortal);

// ── Year-end promotion ────────────────────────────────────────────────────────
studentsRouter.post('/promote', authorize(...ADMIN_ROLES), promoteStudents);
