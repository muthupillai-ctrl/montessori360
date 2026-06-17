import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateAnnouncement, validateCreateCircular,
  validateSendMessage, validateAnnouncementFilters, validateMessageFilters,
} from './communication.validators.js';
import {
  listAnnouncements, getAnnouncement, createAnnouncement, publishAnnouncement, deleteAnnouncement,
  listContacts, listStudentParentAccounts,
  listCirculars, createCircular, acknowledgeCircular,
  listConversations, getConversation, sendMessage, getUnreadCount, markAllRead,
} from './communication.controller.js';

export const communicationRouter = Router();
communicationRouter.use(authenticate);

const BROADCAST_ROLES = ['owner', 'principal', 'teacher'];
const ALL_ROLES       = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'admission_staff', 'driver', 'support', 'parent'];

// ── Announcements ─────────────────────────────────────────────────────────────
communicationRouter.get(   '/announcements',              authorize(...ALL_ROLES),       validateAnnouncementFilters, listAnnouncements);
communicationRouter.post(  '/announcements',              authorize(...BROADCAST_ROLES), validateCreateAnnouncement,  createAnnouncement);
communicationRouter.get(   '/announcements/:id',          authorize(...ALL_ROLES),       getAnnouncement);
communicationRouter.patch( '/announcements/:id/publish',  authorize(...BROADCAST_ROLES), publishAnnouncement);
communicationRouter.delete('/announcements/:id',          authorize('owner', 'principal'), deleteAnnouncement);

// ── Circulars ─────────────────────────────────────────────────────────────────
communicationRouter.get( '/circulars',                    authorize(...ALL_ROLES),       validateAnnouncementFilters, listCirculars);
communicationRouter.post('/circulars',                    authorize(...BROADCAST_ROLES), validateCreateCircular,      createCircular);
communicationRouter.post('/circulars/:id/acknowledge',    authorize(...ALL_ROLES),       acknowledgeCircular);

// ── Messages ──────────────────────────────────────────────────────────────────
communicationRouter.get( '/messages/contacts',                                authorize(...ALL_ROLES), listContacts);
communicationRouter.get( '/messages/student-parents/:studentId',              authorize(...ALL_ROLES), listStudentParentAccounts);
communicationRouter.get( '/messages/unread-count',        authorize(...ALL_ROLES),       getUnreadCount);
communicationRouter.get( '/messages/conversations',       authorize(...ALL_ROLES),       listConversations);
communicationRouter.get( '/messages/conversations/:partnerId', authorize(...ALL_ROLES),  validateMessageFilters, getConversation);
communicationRouter.post('/messages/conversations/:partnerId/read', authorize(...ALL_ROLES), markAllRead);
communicationRouter.post('/messages',                     authorize(...ALL_ROLES),       validateSendMessage, sendMessage);
