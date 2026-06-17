import { tenantQuery } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { feesService } from '../fees/fees.service.js';
import { journalService } from '../journal/journal.service.js';
import { observationsService } from '../observations/observations.service.js';
import { communicationService } from '../communication/communication.service.js';
import type { ParentChild, AttendanceSummary, TransportStatus, HomeworkTask, ParentDashboardCard } from './parent.types.js';

class ParentService {

  private async getStudentIds(schema: string, parentId: string): Promise<string[]> {
    // Try student_parents join first (case-insensitive email match), fall back to student_ids array.
    const rows = await tenantQuery<{ student_id: string }>(
      schema,
      `SELECT DISTINCT sp.student_id
       FROM   student_parents sp
       JOIN   parent_accounts pa ON LOWER(sp.email) = pa.email
       WHERE  pa.id = $1 AND pa.is_active = true AND sp.email IS NOT NULL
       UNION
       SELECT UNNEST(pa.student_ids) AS student_id
       FROM   parent_accounts pa
       WHERE  pa.id = $1 AND pa.is_active = true`,
      [parentId]
    );
    if (rows === null) throw AppError.unauthorized('Parent account not found');
    return rows.map(r => r.student_id);
  }

  private assertOwns(studentIds: string[], studentId: string): void {
    if (!studentIds.includes(studentId)) throw AppError.forbidden('Access denied to this student');
  }

  // ── My children ────────────────────────────────────────────────────────────
  async getMyStudents(schema: string, parentId: string): Promise<ParentChild[]> {
    const ids = await this.getStudentIds(schema, parentId);
    if (!ids.length) return [];
    return tenantQuery<ParentChild>(
      schema,
      `SELECT s.id, s.first_name, s.last_name, s.admission_no, s.profile_photo,
              c.name AS class_name, c.section
       FROM   students s
       LEFT   JOIN classes c ON c.id = s.class_id
       WHERE  s.id = ANY($1) AND s.is_active = true
       ORDER  BY s.first_name`,
      [ids]
    );
  }

  // ── Attendance ─────────────────────────────────────────────────────────────
  async getAttendance(schema: string, parentId: string, studentId: string, month?: string): Promise<AttendanceSummary> {
    const ids = await this.getStudentIds(schema, parentId);
    this.assertOwns(ids, studentId);

    const dateFilter = month
      ? `AND to_char(a.date, 'YYYY-MM') = $2`
      : `AND a.date >= CURRENT_DATE - INTERVAL '30 days'`;
    const params: unknown[] = month ? [studentId, month] : [studentId];

    const records = await tenantQuery<{ date: string; status: string }>(
      schema,
      `SELECT to_char(a.date, 'YYYY-MM-DD') AS date, a.status
       FROM   attendance a
       WHERE  a.student_id = $1 ${dateFilter}
       ORDER  BY a.date DESC`,
      params
    );

    return {
      records,
      present: records.filter(r => r.status === 'present').length,
      absent:  records.filter(r => r.status === 'absent').length,
      late:    records.filter(r => r.status === 'late').length,
    };
  }

  // ── Transport ──────────────────────────────────────────────────────────────
  async getTransportStatus(schema: string, parentId: string, studentId: string, date?: string): Promise<TransportStatus> {
    const ids = await this.getStudentIds(schema, parentId);
    this.assertOwns(ids, studentId);

    const tripDate = date ?? new Date().toISOString().slice(0, 10);

    const rows = await tenantQuery<{
      trip_type: string;
      boarded: boolean;
      boarded_at: string | null;
      route_name: string | null;
    }>(
      schema,
      `SELECT t.trip_type,
              COALESCE(tb.boarded, false) AS boarded,
              tb.boarded_at,
              r.name AS route_name
       FROM   trips t
       JOIN   transport_routes r ON r.id = t.route_id
       LEFT   JOIN trip_boardings tb ON tb.trip_id = t.id AND tb.student_id = $1
       JOIN   route_students rs ON rs.route_id = r.id AND rs.student_id = $1 AND rs.is_active = true
       WHERE  to_char(t.trip_date, 'YYYY-MM-DD') = $2`,
      [studentId, tripDate]
    );

    const morning = rows.find(r => r.trip_type === 'morning') ?? null;
    const evening = rows.find(r => r.trip_type === 'evening') ?? null;

    return {
      morning: morning ? { boarded: morning.boarded, boarded_at: morning.boarded_at, route_name: morning.route_name } : null,
      evening: evening ? { boarded: evening.boarded, boarded_at: evening.boarded_at, route_name: evening.route_name } : null,
    };
  }

  // ── Fees ───────────────────────────────────────────────────────────────────
  async getInvoices(schema: string, parentId: string, studentId: string): Promise<unknown> {
    const ids = await this.getStudentIds(schema, parentId);
    this.assertOwns(ids, studentId);
    const result = await feesService.listInvoices(schema, { student_id: studentId, limit: 50 });
    return result.data;
  }

  // ── Journal ────────────────────────────────────────────────────────────────
  async getJournals(schema: string, parentId: string, studentId: string, filters: Record<string, string> = {}): Promise<unknown> {
    const ids = await this.getStudentIds(schema, parentId);
    this.assertOwns(ids, studentId);
    return journalService.list(schema, { student_id: studentId, published: true, ...filters });
  }

  // ── Observations / progress ────────────────────────────────────────────────
  async getProgress(schema: string, parentId: string, studentId: string): Promise<unknown> {
    const ids = await this.getStudentIds(schema, parentId);
    this.assertOwns(ids, studentId);
    return observationsService.getStudentProgress(schema, studentId);
  }

  // ── Homework ───────────────────────────────────────────────────────────────
  async getHomework(schema: string, parentId: string, studentId: string, filters: { due_from?: string; due_to?: string } = {}): Promise<HomeworkTask[]> {
    const ids = await this.getStudentIds(schema, parentId);
    this.assertOwns(ids, studentId);

    const conditions = [
      `ht.is_published = true`,
      `(ht.student_id = $1 OR ht.class_id = (SELECT class_id FROM students WHERE id = $1))`,
    ];
    const params: unknown[] = [studentId];
    let i = 2;
    if (filters.due_from) { conditions.push(`ht.due_date >= $${i++}`); params.push(filters.due_from); }
    if (filters.due_to)   { conditions.push(`ht.due_date <= $${i++}`); params.push(filters.due_to); }

    return tenantQuery<HomeworkTask>(
      schema,
      `SELECT ht.id, ht.title, ht.description, ht.subject,
              to_char(ht.due_date, 'YYYY-MM-DD') AS due_date,
              ht.is_published, ht.published_at,
              CONCAT(s.first_name, ' ', s.last_name) AS assigned_by
       FROM   homework_tasks ht
       LEFT   JOIN staff s ON s.id = ht.assigned_by
       WHERE  ${conditions.join(' AND ')}
       ORDER  BY ht.due_date DESC`,
      params
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  async getDashboard(schema: string, parentId: string): Promise<ParentDashboardCard[]> {
    const children = await this.getMyStudents(schema, parentId);
    const today = new Date().toISOString().slice(0, 10);

    return Promise.all(children.map(async (child) => {
      const [attendance, fees, journal, transport] = await Promise.allSettled([
        tenantQuery<{ status: string }>(schema,
          `SELECT status FROM attendance WHERE student_id = $1 AND date = $2 LIMIT 1`,
          [child.id, today]),
        tenantQuery<{ cnt: string }>(schema,
          `SELECT COUNT(*)::text AS cnt FROM fee_invoices WHERE student_id = $1 AND status IN ('pending','overdue')`,
          [child.id]),
        tenantQuery<{ mood: string }>(schema,
          `SELECT mood FROM daily_journals WHERE student_id = $1 AND is_published = true ORDER BY date DESC LIMIT 1`,
          [child.id]),
        this.getTransportStatus(schema, parentId, child.id, today).catch(() => null),
      ]);

      return {
        student:                   child,
        today_attendance:          attendance.status === 'fulfilled' ? (attendance.value[0]?.status ?? null) : null,
        outstanding_fees:          fees.status === 'fulfilled' ? parseInt(fees.value[0]?.cnt ?? '0', 10) : 0,
        latest_mood:               journal.status === 'fulfilled' ? (journal.value[0]?.mood ?? null) : null,
        transport_morning_boarded: transport.status === 'fulfilled' && transport.value
                                    ? (transport.value as TransportStatus).morning?.boarded ?? null
                                    : null,
      };
    }));
  }

  // ── Announcements ──────────────────────────────────────────────────────────
  async getAnnouncements(schema: string, parentId: string): Promise<unknown[]> {
    // Get class IDs for parent's children to filter class-targeted announcements
    const studentIds = await this.getStudentIds(schema, parentId);
    const classIds: string[] = [];
    if (studentIds.length) {
      const rows = await tenantQuery<{ class_id: string }>(
        schema,
        `SELECT class_id FROM students WHERE id = ANY($1) AND class_id IS NOT NULL`,
        [studentIds]
      );
      classIds.push(...rows.map(r => r.class_id));
    }

    return tenantQuery<unknown>(
      schema,
      `SELECT a.*,
              to_char(a.published_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS published_at,
              TRIM(CONCAT(s.first_name, ' ', s.last_name))           AS created_by_name
       FROM   announcements a
       LEFT   JOIN staff s ON s.id = a.created_by
       WHERE  a.published_at IS NOT NULL
         AND  (a.expires_at IS NULL OR a.expires_at > now())
         AND  (
               a.audience IN ('parents', 'all')
               OR (a.audience = 'class' AND (
                 $1::uuid[] && a.class_ids
               ))
             )
       ORDER  BY a.published_at DESC
       LIMIT  50`,
      [classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000']]
    );
  }

  // ── Messages (delegate to communicationService) ────────────────────────────
  async getConversations(schema: string, parentId: string): Promise<unknown> {
    return communicationService.listConversations(schema, parentId, 'parent');
  }

  async getThread(schema: string, parentId: string, partnerId: string): Promise<unknown> {
    return communicationService.getConversation(schema, parentId, 'parent', partnerId, 'staff', { page: 1, limit: 50 });
  }

  async sendMessage(schema: string, parentId: string, recipientId: string, body: string): Promise<unknown> {
    return communicationService.sendMessage(
      schema,
      { recipient_id: recipientId, recipient_type: 'staff', body },
      parentId,
      'parent'
    );
  }

  async getUnreadCount(schema: string, parentId: string): Promise<number> {
    return communicationService.getUnreadCount(schema, parentId);
  }

  async markRead(schema: string, parentId: string, partnerId: string): Promise<void> {
    return communicationService.markAllRead(schema, parentId, partnerId);
  }

  // ── Profile ─────────────────────────────────────────────────────────────────
  async getProfile(schema: string, parentId: string): Promise<unknown> {
    const [row] = await tenantQuery(
      schema,
      `SELECT id, email, first_name, last_name, phone, relation, student_ids, is_active
       FROM   parent_accounts WHERE id = $1`,
      [parentId]
    );
    if (!row) throw AppError.notFound('Parent account');
    return row;
  }
}

export const parentService = new ParentService();
