import { Request, Response } from 'express';
import { parentService } from './parent.service.js';

const id   = (req: Request) => req.user!.sub;
const sch  = (req: Request) => req.user!.tenantSchema;
const sid  = (req: Request) => req.params['studentId'] as string;

export async function getProfile(req: Request, res: Response)   { res.json({ data: await parentService.getProfile(sch(req), id(req)) }); }
export async function getMyStudents(req: Request, res: Response) { res.json({ data: await parentService.getMyStudents(sch(req), id(req)) }); }
export async function getDashboard(req: Request, res: Response)  { res.json({ data: await parentService.getDashboard(sch(req), id(req)) }); }

export async function getAttendance(req: Request, res: Response) {
  res.json({ data: await parentService.getAttendance(sch(req), id(req), sid(req), req.query['month'] as string | undefined) });
}

export async function getTransport(req: Request, res: Response) {
  res.json({ data: await parentService.getTransportStatus(sch(req), id(req), sid(req), req.query['date'] as string | undefined) });
}

export async function getInvoices(req: Request, res: Response) {
  res.json({ data: await parentService.getInvoices(sch(req), id(req), sid(req)) });
}

export async function getPaymentHistory(req: Request, res: Response) {
  res.json({ data: await parentService.getPaymentHistory(sch(req), id(req), sid(req), req.params['invoiceId'] as string) });
}

export async function getJournals(req: Request, res: Response) {
  res.json({ data: await parentService.getJournals(sch(req), id(req), sid(req), req.query as Record<string, string>) });
}

export async function getProgress(req: Request, res: Response) {
  res.json({ data: await parentService.getProgress(sch(req), id(req), sid(req)) });
}

export async function getHomework(req: Request, res: Response) {
  res.json({ data: await parentService.getHomework(sch(req), id(req), sid(req), {
    due_from: req.query['due_from'] as string | undefined,
    due_to:   req.query['due_to']   as string | undefined,
  }) });
}

// ── Announcements & Messages ────────────────────────────────────────────────
export async function getAnnouncements(req: Request, res: Response) {
  res.json({ data: await parentService.getAnnouncements(sch(req), id(req)) });
}

export async function getConversations(req: Request, res: Response) {
  res.json({ data: await parentService.getConversations(sch(req), id(req)) });
}

export async function getThread(req: Request, res: Response) {
  const partnerId = req.params['partnerId'] as string;
  res.json(await parentService.getThread(sch(req), id(req), partnerId));
}

export async function sendMessage(req: Request, res: Response) {
  const { recipient_id, body } = req.body as { recipient_id: string; body: string };
  res.status(201).json({ data: await parentService.sendMessage(sch(req), id(req), recipient_id, body) });
}

export async function getUnreadCount(req: Request, res: Response) {
  res.json({ data: { unread_count: await parentService.getUnreadCount(sch(req), id(req)) } });
}

export async function markRead(req: Request, res: Response) {
  await parentService.markRead(sch(req), id(req), req.params['partnerId'] as string);
  res.json({ message: 'Marked as read' });
}

export async function getStaffContacts(req: Request, res: Response) {
  const { communicationService } = await import('../communication/communication.service.js');
  res.json({ data: await communicationService.listStaffContacts(sch(req), id(req)) });
}
