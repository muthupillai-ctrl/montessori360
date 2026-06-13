import { tenantQuery } from '../../config/database.js';
import { cacheSet, cacheGet } from '../../config/redis.js';
import type {
  DashboardResponse, StudentMetrics, AttendanceMetrics,
  FeeMetrics, StaffMetrics, CommunicationMetrics,
  JournalMetrics, ObservationMetrics, TransportMetrics,
} from './analytics.types.js';

// Cache dashboard for 2 minutes — fresh enough, avoids hammering DB on every page load
const CACHE_TTL = 120;

class AnalyticsService {

  async getDashboard(schema: string, userId: string): Promise<DashboardResponse> {
    const cacheKey = `${schema}:analytics:dashboard`;
    const cached = await cacheGet<DashboardResponse>(cacheKey);
    if (cached) return cached;

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const yearStart  = today.slice(0, 4) + '-06-01'; // academic year starts June
    const weekAgo    = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const [
      students, attendance, fees, staff,
      communication, journals, observations, transport, academicYear,
    ] = await Promise.all([
      this.getStudentMetrics(schema, today, monthStart),
      this.getAttendanceMetrics(schema, today, weekAgo),
      this.getFeeMetrics(schema, monthStart, today, yearStart),
      this.getStaffMetrics(schema, today),
      this.getCommunicationMetrics(schema, userId, weekAgo),
      this.getJournalMetrics(schema, today, weekAgo),
      this.getObservationMetrics(schema, weekAgo),
      this.getTransportMetrics(schema, today),
      this.getCurrentAcademicYear(schema),
    ]);

    const dashboard: DashboardResponse = {
      generated_at:  new Date().toISOString(),
      academic_year: academicYear,
      students,
      attendance,
      fees,
      staff,
      communication,
      journals,
      observations,
      transport,
    };

    await cacheSet(cacheKey, dashboard, CACHE_TTL);
    return dashboard;
  }

  // ── Students ──────────────────────────────────────────────────────────────

  private async getStudentMetrics(schema: string, today: string, monthStart: string): Promise<StudentMetrics> {
    const [totals] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*)                                          AS total_enrolled,
         COUNT(*) FILTER (WHERE is_active = true)         AS active,
         COUNT(*) FILTER (WHERE is_active = true
           AND admission_date >= $1)                      AS new_this_month
       FROM ${schema}.students`,
      [monthStart]
    );

    const byClass = await tenantQuery<any>(
      schema,
      `SELECT c.id AS class_id, c.name AS class_name,
              c.capacity,
              COUNT(s.id)::int AS count,
              ROUND(COUNT(s.id) * 100.0 / NULLIF(c.capacity, 0), 1)::float AS fill_pct
       FROM   ${schema}.classes c
       LEFT JOIN ${schema}.students s ON s.class_id = c.id AND s.is_active = true
       WHERE  c.is_active = true
       GROUP  BY c.id, c.name, c.capacity
       ORDER  BY c.name`
    );

    const [gender] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*) FILTER (WHERE gender = 'male')::int   AS male,
         COUNT(*) FILTER (WHERE gender = 'female')::int AS female,
         COUNT(*) FILTER (WHERE gender = 'other')::int  AS other
       FROM ${schema}.students WHERE is_active = true`
    );

    return {
      total_enrolled: parseInt(totals.total_enrolled),
      active:         parseInt(totals.active),
      new_this_month: parseInt(totals.new_this_month),
      by_class:       byClass,
      by_gender:      gender,
    };
  }

  // ── Attendance ────────────────────────────────────────────────────────────

  private async getAttendanceMetrics(schema: string, today: string, weekAgo: string): Promise<AttendanceMetrics> {
    // Today's stats
    const [todayStats] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(s.id)::int                                              AS total,
         COUNT(a.id) FILTER (WHERE a.status = 'present')::int         AS present,
         COUNT(a.id) FILTER (WHERE a.status = 'absent')::int          AS absent,
         COUNT(a.id) FILTER (WHERE a.status = 'late')::int            AS late,
         ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','late'))
           * 100.0 / NULLIF(COUNT(s.id), 0), 1)::float                AS rate_pct
       FROM ${schema}.students s
       LEFT JOIN ${schema}.attendance a ON a.student_id = s.id AND a.date = $1
       WHERE s.is_active = true`,
      [today]
    );

    const total      = todayStats.total ?? 0;
    const markedCount = (todayStats.present ?? 0) + (todayStats.absent ?? 0) + (todayStats.late ?? 0);
    const notMarked  = total - markedCount;

    // Weekly trend (last 7 days)
    const weeklyTrend = await tenantQuery<any>(
      schema,
      `SELECT
         a.date::text                                                       AS date,
         COUNT(a.id) FILTER (WHERE a.status IN ('present','late'))::int    AS present,
         COUNT(s.id)::int                                                   AS total,
         ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','late'))
           * 100.0 / NULLIF(COUNT(s.id), 0), 1)::float                    AS rate_pct
       FROM   generate_series($1::date, $2::date, '1 day') AS d(date)
       CROSS JOIN ${schema}.students s
       LEFT JOIN ${schema}.attendance a ON a.student_id = s.id AND a.date = d.date
       WHERE  s.is_active = true
         AND  EXTRACT(DOW FROM d.date) NOT IN (0, 6)
       GROUP  BY a.date
       ORDER  BY a.date`,
      [weekAgo, today]
    );

    // Monthly average
    const [monthlyAvg] = await tenantQuery<any>(
      schema,
      `SELECT ROUND(AVG(daily_rate), 1)::float AS monthly_avg
       FROM (
         SELECT
           a.date,
           COUNT(a.id) FILTER (WHERE a.status IN ('present','late')) * 100.0
             / NULLIF(COUNT(s.id), 0) AS daily_rate
         FROM   ${schema}.students s
         LEFT JOIN ${schema}.attendance a ON a.student_id = s.id
         WHERE  s.is_active = true
           AND  a.date >= date_trunc('month', NOW())
         GROUP  BY a.date
       ) daily`,
      []
    );

    // By class
    const byClass = await tenantQuery<any>(
      schema,
      `SELECT c.id AS class_id, c.name AS class_name,
              ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','late'))
                * 100.0 / NULLIF(COUNT(s.id), 0), 1)::float AS rate_pct
       FROM   ${schema}.classes c
       JOIN   ${schema}.students s ON s.class_id = c.id AND s.is_active = true
       LEFT JOIN ${schema}.attendance a ON a.student_id = s.id AND a.date = $1
       WHERE  c.is_active = true
       GROUP  BY c.id, c.name
       ORDER  BY c.name`,
      [today]
    );

    return {
      today: {
        date:       today,
        total,
        present:    todayStats.present ?? 0,
        absent:     todayStats.absent ?? 0,
        late:       todayStats.late ?? 0,
        not_marked: notMarked,
        rate_pct:   todayStats.rate_pct ?? 0,
      },
      weekly_trend: weeklyTrend,
      monthly_avg:  monthlyAvg?.monthly_avg ?? 0,
      by_class:     byClass,
    };
  }

  // ── Fees ──────────────────────────────────────────────────────────────────

  private async getFeeMetrics(schema: string, monthStart: string, today: string, yearStart: string): Promise<FeeMetrics> {
    const [monthStats] = await tenantQuery<any>(
      schema,
      `SELECT
         COALESCE(SUM(total), 0)::numeric(12,2)                    AS billed,
         COALESCE(SUM(paid_amount), 0)::numeric(12,2)              AS collected,
         COALESCE(SUM(total - paid_amount)
           FILTER (WHERE status NOT IN ('paid','waived')), 0)
           ::numeric(12,2)                                         AS outstanding,
         ROUND(COALESCE(SUM(paid_amount), 0)
           * 100.0 / NULLIF(SUM(total), 0), 1)::float             AS collection_pct
       FROM ${schema}.fee_invoices
       WHERE created_at::date BETWEEN $1 AND $2`,
      [monthStart, today]
    );

    const [ytdStats] = await tenantQuery<any>(
      schema,
      `SELECT
         COALESCE(SUM(total), 0)::numeric(12,2)               AS billed,
         COALESCE(SUM(paid_amount), 0)::numeric(12,2)          AS collected,
         COALESCE(SUM(total - paid_amount)
           FILTER (WHERE status NOT IN ('paid','waived')), 0)
           ::numeric(12,2)                                     AS outstanding
       FROM ${schema}.fee_invoices
       WHERE created_at::date >= $1`,
      [yearStart]
    );

    const [byStatus] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending,
         COUNT(*) FILTER (WHERE status = 'paid')::int     AS paid,
         COUNT(*) FILTER (WHERE status = 'partial')::int  AS partial,
         COUNT(*) FILTER (WHERE status = 'overdue')::int  AS overdue,
         COUNT(*) FILTER (WHERE status = 'waived')::int   AS waived
       FROM ${schema}.fee_invoices`
    );

    const [defaulters] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(DISTINCT student_id)::int AS count
       FROM ${schema}.fee_invoices
       WHERE status IN ('pending','partial','overdue') AND due_date < CURRENT_DATE`
    );

    const recentPayments = await tenantQuery<any>(
      schema,
      `SELECT CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              i.paid_amount::numeric(10,2) AS amount,
              i.payment_method AS method,
              i.paid_at::text AS paid_at
       FROM   ${schema}.fee_invoices i
       JOIN   ${schema}.students s ON s.id = i.student_id
       WHERE  i.status IN ('paid','partial') AND i.paid_at IS NOT NULL
       ORDER  BY i.paid_at DESC LIMIT 5`
    );

    return {
      current_month: {
        billed:         parseFloat(monthStats?.billed ?? 0),
        collected:      parseFloat(monthStats?.collected ?? 0),
        outstanding:    parseFloat(monthStats?.outstanding ?? 0),
        collection_pct: monthStats?.collection_pct ?? 0,
      },
      ytd: {
        billed:      parseFloat(ytdStats?.billed ?? 0),
        collected:   parseFloat(ytdStats?.collected ?? 0),
        outstanding: parseFloat(ytdStats?.outstanding ?? 0),
      },
      by_status:        byStatus ?? { pending:0, paid:0, partial:0, overdue:0, waived:0 },
      defaulters_count: defaulters?.count ?? 0,
      recent_payments:  recentPayments,
    };
  }

  // ── Staff ─────────────────────────────────────────────────────────────────

  private async getStaffMetrics(schema: string, today: string): Promise<StaffMetrics> {
    const [totals] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*) FILTER (WHERE is_active = true)::int AS total_active
       FROM ${schema}.staff`
    );

    const byRole = await tenantQuery<any>(
      schema,
      `SELECT role, COUNT(*)::int AS count
       FROM ${schema}.staff WHERE is_active = true
       GROUP BY role ORDER BY count DESC`
    );

    const [leaves] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending_leaves,
         COUNT(*) FILTER (WHERE status = 'approved'
           AND from_date <= $1 AND to_date >= $1)::int    AS on_leave_today
       FROM ${schema}.leave_requests`,
      [today]
    );

    const [shifts] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS shifts_today FROM ${schema}.shifts WHERE date = $1`,
      [today]
    );

    return {
      total_active:   totals?.total_active ?? 0,
      by_role:        byRole,
      pending_leaves: leaves?.pending_leaves ?? 0,
      on_leave_today: leaves?.on_leave_today ?? 0,
      shifts_today:   shifts?.shifts_today ?? 0,
    };
  }

  // ── Communication ─────────────────────────────────────────────────────────

  private async getCommunicationMetrics(schema: string, userId: string, weekAgo: string): Promise<CommunicationMetrics> {
    const [messages] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS unread
       FROM ${schema}.messages
       WHERE recipient_id = $1 AND is_read = false`,
      [userId]
    );

    const [circulars] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS pending
       FROM ${schema}.circulars c
       WHERE c.requires_ack = true
         AND c.published_at IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM ${schema}.circular_acknowledgements ca
           WHERE ca.circular_id = c.id AND ca.acknowledged_by = $1
         )`,
      [userId]
    );

    const [announcements] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS count
       FROM ${schema}.announcements
       WHERE published_at >= $1`,
      [weekAgo]
    );

    return {
      unread_messages:         messages?.unread ?? 0,
      pending_ack_circulars:   circulars?.pending ?? 0,
      announcements_this_week: announcements?.count ?? 0,
    };
  }

  // ── Journals ──────────────────────────────────────────────────────────────

  private async getJournalMetrics(schema: string, today: string, weekAgo: string): Promise<JournalMetrics> {
    const [todayStats] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(s.id)::int                                             AS total_students,
         COUNT(j.id)::int                                             AS journals_created,
         COUNT(j.id) FILTER (WHERE j.published_at IS NOT NULL)::int  AS journals_published
       FROM   ${schema}.students s
       LEFT JOIN ${schema}.daily_journals j ON j.student_id = s.id AND j.journal_date = $1
       WHERE  s.is_active = true`,
      [today]
    );

    const total = todayStats?.total_students ?? 0;
    const created = todayStats?.journals_created ?? 0;

    const [moods] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*) FILTER (WHERE mood = 'happy')::int     AS happy,
         COUNT(*) FILTER (WHERE mood = 'calm')::int      AS calm,
         COUNT(*) FILTER (WHERE mood = 'unsettled')::int AS unsettled,
         COUNT(*) FILTER (WHERE mood = 'upset')::int     AS upset
       FROM ${schema}.daily_journals
       WHERE journal_date BETWEEN $1 AND $2 AND mood IS NOT NULL`,
      [weekAgo, today]
    );

    return {
      today: {
        total_students:     total,
        journals_created:   created,
        journals_published: todayStats?.journals_published ?? 0,
        completion_pct:     total > 0 ? Math.round(created * 100 / total) : 0,
      },
      mood_this_week: {
        happy:     moods?.happy ?? 0,
        calm:      moods?.calm ?? 0,
        unsettled: moods?.unsettled ?? 0,
        upset:     moods?.upset ?? 0,
      },
    };
  }

  // ── Observations ──────────────────────────────────────────────────────────

  private async getObservationMetrics(schema: string, weekAgo: string): Promise<ObservationMetrics> {
    const byDomain = await tenantQuery<any>(
      schema,
      `SELECT
         d.name AS domain_name,
         d.code AS domain_code,
         COUNT(o.id)::int                                               AS total_obs,
         ROUND(COUNT(o.id) FILTER (WHERE o.grade = 'mastered')
           * 100.0 / NULLIF(COUNT(o.id), 0), 1)::float                AS mastery_pct
       FROM   ${schema}.obs_domains d
       LEFT JOIN ${schema}.obs_milestones m ON m.domain_id = d.id
       LEFT JOIN ${schema}.observations o   ON o.milestone_id = m.id
       WHERE  d.is_active = true
       GROUP  BY d.id, d.name, d.code
       ORDER  BY d.sort_order`
    );

    const [recent] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS count
       FROM ${schema}.observations WHERE observed_on >= $1`,
      [weekAgo]
    );

    const overallPct = byDomain.length
      ? Math.round(byDomain.reduce((s: number, d: any) => s + (d.mastery_pct ?? 0), 0) / byDomain.length * 10) / 10
      : 0;

    return {
      overall_mastery_pct: overallPct,
      by_domain:           byDomain,
      recently_observed:   recent?.count ?? 0,
    };
  }

  // ── Transport ─────────────────────────────────────────────────────────────

  private async getTransportMetrics(schema: string, today: string): Promise<TransportMetrics> {
    const [routes] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS active_routes FROM ${schema}.transport_routes WHERE is_active = true`
    );

    const [trips] = await tenantQuery<any>(
      schema,
      `SELECT
         COUNT(*)::int                                            AS trips_today,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int     AS trips_in_progress
       FROM ${schema}.trips WHERE trip_date = $1`,
      [today]
    );

    const [students] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS count FROM ${schema}.route_students`
    );

    const [expiry] = await tenantQuery<any>(
      schema,
      `SELECT COUNT(*)::int AS count FROM ${schema}.vehicles
       WHERE is_active = true
         AND (fitness_expiry < CURRENT_DATE + 30 OR insurance_expiry < CURRENT_DATE + 30)`
    );

    return {
      active_routes:          routes?.active_routes ?? 0,
      trips_today:            trips?.trips_today ?? 0,
      trips_in_progress:      trips?.trips_in_progress ?? 0,
      students_on_transport:  students?.count ?? 0,
      expiry_alerts:          expiry?.count ?? 0,
    };
  }

  // ── Academic year helper ──────────────────────────────────────────────────

  private async getCurrentAcademicYear(schema: string): Promise<string | null> {
    try {
      const [row] = await tenantQuery<any>(
        schema, `SELECT name FROM ${schema}.academic_years WHERE is_current = true LIMIT 1`
      );
      return row?.name ?? null;
    } catch {
      return null;
    }
  }

  // ── Individual drill-down methods ─────────────────────────────────────────

  async getAttendanceTrend(schema: string, from: string, to: string) {
    return tenantQuery<any>(
      schema,
      `SELECT
         a.date::text AS date,
         COUNT(a.id) FILTER (WHERE a.status IN ('present','late'))::int AS present,
         COUNT(s.id)::int AS total,
         ROUND(COUNT(a.id) FILTER (WHERE a.status IN ('present','late'))
           * 100.0 / NULLIF(COUNT(s.id), 0), 1)::float AS rate_pct
       FROM   generate_series($1::date, $2::date, '1 day') AS d(date)
       CROSS JOIN ${schema}.students s
       LEFT JOIN ${schema}.attendance a ON a.student_id = s.id AND a.date = d.date
       WHERE  s.is_active = true AND EXTRACT(DOW FROM d.date) NOT IN (0, 6)
       GROUP  BY a.date ORDER BY a.date`,
      [from, to]
    );
  }

  async getFeeCollection(schema: string, from: string, to: string) {
    return tenantQuery<any>(
      schema,
      `SELECT
         DATE_TRUNC('week', paid_at)::date::text AS week,
         SUM(paid_amount)::numeric(12,2)          AS collected,
         COUNT(*)::int                            AS invoices
       FROM ${schema}.fee_invoices
       WHERE paid_at::date BETWEEN $1 AND $2
         AND status IN ('paid','partial')
       GROUP BY DATE_TRUNC('week', paid_at)
       ORDER BY week`,
      [from, to]
    );
  }


  async getStaffDashboard(schema: string, staffId: string): Promise<any> {
    const today = new Date().toISOString().slice(0, 10);
    const in7   = new Date(Date.now() + 7*86400000).toISOString().slice(0, 10);

    // My classes
    const myClasses = await tenantQuery<any>(schema,
      `SELECT c.id, c.name, c.age_group_min, c.age_group_max,
              COUNT(s.id)::int AS student_count,
              COUNT(s.id) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM ${schema}.attendance a
                  WHERE a.student_id = s.id AND a.date = $2 AND a.status = 'present'
                )
              )::int AS present_today
       FROM   ${schema}.classes c
       LEFT JOIN ${schema}.students s ON s.class_id = c.id AND s.is_active = true
       WHERE  c.teacher_id = $1
       GROUP  BY c.id, c.name, c.age_group_min, c.age_group_max`,
      [staffId, today]
    );

    // My leave balance
    const [balance] = await tenantQuery<any>(schema,
      `SELECT casual, sick, earned, casual_used, sick_used, earned_used, academic_year
       FROM ${schema}.leave_balances
       WHERE staff_id = $1
       ORDER BY academic_year DESC LIMIT 1`,
      [staffId]
    );

    // My pending leave requests
    const myLeaveRequests = await tenantQuery<any>(schema,
      `SELECT id, leave_type, from_date, to_date, days, status
       FROM ${schema}.leave_requests
       WHERE staff_id = $1 AND status IN ('pending','approved')
       ORDER BY from_date ASC LIMIT 5`,
      [staffId]
    );

    // Latest announcements
    const announcements = await tenantQuery<any>(schema,
      `SELECT a.id, a.title, a.body, a.published_at,
              CONCAT(s.first_name,' ',s.last_name) AS author
       FROM   ${schema}.announcements a
       LEFT JOIN ${schema}.staff s ON s.id = a.created_by
       WHERE  a.published_at IS NOT NULL
         AND  (a.audience = 'staff' OR a.audience = 'all')
       ORDER  BY a.published_at DESC LIMIT 5`,
      []
    );

    // Unread messages
    const [msgs] = await tenantQuery<any>(schema,
      `SELECT COUNT(*)::int AS unread FROM ${schema}.messages
       WHERE recipient_id = $1 AND is_read = false`,
      [staffId]
    );

    return {
      my_classes:   myClasses,
      balance:      balance ?? null,
      leave_requests: myLeaveRequests,
      announcements,
      unread_messages: msgs?.unread ?? 0,
      today,
    };
  }

  async getLeaveOverview(schema: string): Promise<any> {
    const today = new Date().toISOString().slice(0, 10);
    const in7   = new Date(Date.now() + 7*86400000).toISOString().slice(0, 10);

    // On leave today
    const onLeaveToday = await tenantQuery<any>(schema,
      `SELECT lr.id, lr.leave_type, lr.from_date, lr.to_date, lr.days,
              CONCAT(s.first_name,' ',s.last_name) AS staff_name,
              s.role, sd.employee_no
       FROM   ${schema}.leave_requests lr
       JOIN   ${schema}.staff s ON s.id = lr.staff_id
       LEFT JOIN ${schema}.staff_details sd ON sd.staff_id = s.id
       WHERE  lr.status = 'approved'
         AND  lr.from_date <= $1 AND lr.to_date >= $1
       ORDER  BY lr.from_date`,
      [today]
    );

    // Upcoming leaves next 7 days
    const upcomingLeaves = await tenantQuery<any>(schema,
      `SELECT lr.id, lr.leave_type, lr.from_date, lr.to_date, lr.days,
              CONCAT(s.first_name,' ',s.last_name) AS staff_name,
              s.role
       FROM   ${schema}.leave_requests lr
       JOIN   ${schema}.staff s ON s.id = lr.staff_id
       WHERE  lr.status = 'approved'
         AND  lr.from_date > $1 AND lr.from_date <= $2
       ORDER  BY lr.from_date LIMIT 10`,
      [today, in7]
    );

    // Pending approvals
    const pendingApprovals = await tenantQuery<any>(schema,
      `SELECT lr.id, lr.leave_type, lr.from_date, lr.to_date, lr.days, lr.reason,
              CONCAT(s.first_name,' ',s.last_name) AS staff_name,
              s.role
       FROM   ${schema}.leave_requests lr
       JOIN   ${schema}.staff s ON s.id = lr.staff_id
       WHERE  lr.status = 'pending'
       ORDER  BY lr.created_at ASC LIMIT 10`,
      []
    );

    // Monthly stats
    const monthStart = today.slice(0,7) + '-01';
    const [stats] = await tenantQuery<any>(schema,
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'approved' AND from_date <= $1 AND to_date >= $1)::int AS on_leave_today,
         COUNT(*) FILTER (WHERE status = 'approved' AND from_date >= $2)::int AS this_month,
         COUNT(*) FILTER (WHERE status = 'approved' AND leave_type = 'lwp' AND from_date >= $2)::int AS lwp_month
       FROM ${schema}.leave_requests`,
      [today, monthStart]
    );

    return { on_leave_today: onLeaveToday, upcoming_leaves: upcomingLeaves, pending_approvals: pendingApprovals, stats };
  }
}

export const analyticsService = new AnalyticsService();
