import { Request, Response } from 'express';
import { communicationService } from './communication.service.js';
import type {
  CreateAnnouncementDto, CreateCircularDto, SendMessageDto,
  AnnouncementFilters, MessageFilters,
} from './communication.types.js';

// ── Announcements ─────────────────────────────────────────────────────────────

export async function listAnnouncements(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as AnnouncementFilters;
  const role    = req.user!.role;

  // Enforce audience scoping based on caller role — unless admin/principal who sees all
  if (!['owner', 'principal'].includes(role) && !filters.audience) {
    filters.audience = role === 'parent' ? 'parents' : 'staff' as any;
  }

  const result = await communicationService.listAnnouncements(req.user!.tenantSchema, filters);
  res.json(result);
}

export async function getAnnouncement(req: Request, res: Response): Promise<void> {
  const row = await communicationService.getAnnouncement(req.user!.tenantSchema, String(req.params.id));
  res.json({ data: row });
}

export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  const row = await communicationService.createAnnouncement(
    req.user!.tenantSchema, req.body as CreateAnnouncementDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Announcement created successfully' });
}

export async function publishAnnouncement(req: Request, res: Response): Promise<void> {
  const row = await communicationService.publishAnnouncement(req.user!.tenantSchema, String(req.params.id));
  res.json({ data: row, message: 'Announcement published successfully' });
}

export async function deleteAnnouncement(req: Request, res: Response): Promise<void> {
  await communicationService.deleteAnnouncement(req.user!.tenantSchema, String(req.params.id));
  res.json({ message: 'Announcement deleted successfully' });
}

// ── Circulars ─────────────────────────────────────────────────────────────────

export async function listCirculars(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as AnnouncementFilters;
  const role    = req.user!.role;

  if (!['owner', 'principal'].includes(role) && !filters.audience) {
    filters.audience = role === 'parent' ? 'parents' : 'staff' as any;
  }

  const result = await communicationService.listCirculars(req.user!.tenantSchema, filters, req.user!.sub);
  res.json(result);
}

export async function createCircular(req: Request, res: Response): Promise<void> {
  const row = await communicationService.createCircular(
    req.user!.tenantSchema, req.body as CreateCircularDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Circular created successfully' });
}

export async function acknowledgeCircular(req: Request, res: Response): Promise<void> {
  const role = req.user!.role;
  if (['owner', 'principal'].includes(role)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admins cannot acknowledge circulars — they are the sender.' } });
    return;
  }
  const userType = role === 'parent' ? 'parent' : 'staff';
  await communicationService.acknowledgeCircular(
    req.user!.tenantSchema, String(req.params.id), req.user!.sub, userType
  );
  res.json({ message: 'Circular acknowledged successfully' });
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listConversations(req: Request, res: Response): Promise<void> {
  const userType = req.user!.role === 'parent' ? 'parent' : 'staff';
  const rows = await communicationService.listConversations(
    req.user!.tenantSchema, req.user!.sub, userType
  );
  res.json({ data: rows });
}

export async function getConversation(req: Request, res: Response): Promise<void> {
  const filters = ((req as any).parsedQuery ?? req.query) as MessageFilters;
  const userType = req.user!.role === 'parent' ? 'parent' : 'staff';
  const partnerType = req.query.partner_type as 'staff' | 'parent' ?? 'staff';

  const result = await communicationService.getConversation(
    req.user!.tenantSchema,
    req.user!.sub, userType,
    String(req.params.partnerId), partnerType,
    filters
  );
  res.json(result);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const senderType = req.user!.role === 'parent' ? 'parent' : 'staff';
  const message = await communicationService.sendMessage(
    req.user!.tenantSchema, req.body as SendMessageDto, req.user!.sub, senderType
  );
  res.status(201).json({ data: message, message: 'Message sent successfully' });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await communicationService.getUnreadCount(req.user!.tenantSchema, req.user!.sub);
  res.json({ data: { unread_count: count } });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  await communicationService.markAllRead(
    req.user!.tenantSchema, req.user!.sub, String(req.params.partnerId)
  );
  res.json({ message: 'Messages marked as read' });
}

export async function listContacts(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const userId = req.user!.sub;
  const role   = req.user!.role;
  const staff  = await communicationService.listStaffContacts(schema, userId);
  res.json({ data: staff });
}

// Returns parent_accounts (portal users) for a specific student — used by staff to message parents
export async function listStudentParentAccounts(req: Request, res: Response): Promise<void> {
  const schema    = req.user!.tenantSchema;
  const studentId = String(req.params.studentId);
  console.log('[listStudentParentAccounts] schema=%s studentId=%s', schema, studentId);
  const rows      = await communicationService.listParentAccountsByStudent(schema, studentId);
  console.log('[listStudentParentAccounts] found %d rows: %j', rows.length, rows);
  res.json({ data: rows });
}
