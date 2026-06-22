import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  getProfile, getMyStudents, getDashboard,
  getAttendance, getTransport, getInvoices, getPaymentHistory,
  getJournals, getProgress, getHomework,
  getAnnouncements,
  getConversations, getThread, sendMessage, getUnreadCount, markRead, getStaffContacts,
} from './parent.controller.js';

export const parentRouter = Router();
parentRouter.use(authenticate, authorize('parent'));

parentRouter.get('/me',                              getProfile);
parentRouter.get('/students',                        getMyStudents);
parentRouter.get('/dashboard',                       getDashboard);
parentRouter.get('/students/:studentId/attendance',  getAttendance);
parentRouter.get('/students/:studentId/transport',   getTransport);
parentRouter.get('/students/:studentId/fees',                              getInvoices);
parentRouter.get('/students/:studentId/fees/:invoiceId/payments',          getPaymentHistory);
parentRouter.get('/students/:studentId/journal',     getJournals);
parentRouter.get('/students/:studentId/progress',    getProgress);
parentRouter.get('/students/:studentId/homework',    getHomework);

// ── Announcements ─────────────────────────────────────────────────────────
parentRouter.get('/announcements', getAnnouncements);

// ── Messages ──────────────────────────────────────────────────────────────
parentRouter.get('/messages/contacts',                    getStaffContacts);
parentRouter.get('/messages/unread-count',                getUnreadCount);
parentRouter.get('/messages/conversations',               getConversations);
parentRouter.get('/messages/conversations/:partnerId',    getThread);
parentRouter.post('/messages/conversations/:partnerId/read', markRead);
parentRouter.post('/messages',                            sendMessage);
