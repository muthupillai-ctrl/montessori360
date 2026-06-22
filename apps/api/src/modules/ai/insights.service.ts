import { tenantQuery, tenantTransaction, query } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export type InsightType =
  | 'attendance_drop'
  | 'chronic_absenteeism'
  | 'fee_default_risk'
  | 'uncovered_class';

export type InsightSeverity = 'low' | 'medium' | 'high';

export interface AiInsightRow {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  student_id: string | null;
  class_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
}

class InsightsService {

  async ensureTable(schema: string): Promise<void> {
    await tenantQuery(schema, `
      CREATE TABLE IF NOT EXISTS ${schema}.ai_insights (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type         TEXT NOT NULL,
        severity     TEXT NOT NULL DEFAULT 'medium',
        student_id   UUID REFERENCES ${schema}.students(id) ON DELETE CASCADE,
        class_id     UUID,
        message      TEXT NOT NULL,
        metadata     JSONB NOT NULL DEFAULT '{}',
        resolved_at  TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await tenantQuery(schema, `
      CREATE INDEX IF NOT EXISTS idx_${schema}_ai_insights_type
        ON ${schema}.ai_insights (type, resolved_at, created_at DESC)
    `);
  }

  // ── Fetch unresolved insights for the notification bell ────────────────────
  async listUnresolved(schema: string, limit = 50): Promise<AiInsightRow[]> {
    await this.ensureTable(schema);
    return tenantQuery<AiInsightRow>(schema, `
      SELECT i.*,
             NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), '') AS student_name
      FROM   ${schema}.ai_insights i
      LEFT   JOIN ${schema}.students s ON s.id = i.student_id
      WHERE  i.resolved_at IS NULL
      ORDER  BY CASE i.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                i.created_at DESC
      LIMIT  $1
    `, [limit]);
  }

  async resolve(schema: string, id: string): Promise<void> {
    await tenantQuery(schema, `
      UPDATE ${schema}.ai_insights SET resolved_at = NOW() WHERE id = $1
    `, [id]);
  }

  async resolveAll(schema: string): Promise<void> {
    await tenantQuery(schema, `
      UPDATE ${schema}.ai_insights SET resolved_at = NOW() WHERE resolved_at IS NULL
    `);
  }

  async unresolvedCount(schema: string): Promise<number> {
    await this.ensureTable(schema);
    const [row] = await tenantQuery<{ count: string }>(schema, `
      SELECT COUNT(*)::text AS count FROM ${schema}.ai_insights WHERE resolved_at IS NULL
    `);
    return parseInt(row?.count ?? '0');
  }

  // ── Attendance drop detector ───────────────────────────────────────────────
  // Compares each active student's attendance in the last 14 days vs prior 28 days.
  // Flags if attendance rate dropped by ≥30 percentage points.
  async detectAttendanceDrop(schema: string): Promise<number> {
    const rows = await tenantQuery<{
      student_id: string; full_name: string;
      recent_rate: string; baseline_rate: string;
    }>(schema, `
      WITH recent AS (
        SELECT student_id,
               COUNT(*) FILTER (WHERE status = 'present') AS present,
               COUNT(*) AS total
        FROM   ${schema}.attendance
        WHERE  date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP  BY student_id
      ),
      baseline AS (
        SELECT student_id,
               COUNT(*) FILTER (WHERE status = 'present') AS present,
               COUNT(*) AS total
        FROM   ${schema}.attendance
        WHERE  date >= CURRENT_DATE - INTERVAL '42 days'
          AND  date <  CURRENT_DATE - INTERVAL '14 days'
        GROUP  BY student_id
      )
      SELECT s.id AS student_id,
             TRIM(s.first_name || ' ' || s.last_name) AS full_name,
             ROUND(100.0 * r.present / NULLIF(r.total, 0), 1) AS recent_rate,
             ROUND(100.0 * b.present / NULLIF(b.total, 0), 1) AS baseline_rate
      FROM   recent r
      JOIN   baseline b USING (student_id)
      JOIN   ${schema}.students s ON s.id = r.student_id
      WHERE  s.is_active = true
        AND  r.total >= 5
        AND  b.total >= 10
        AND  (100.0 * r.present / NULLIF(r.total, 0))
             < (100.0 * b.present / NULLIF(b.total, 0)) - 30
    `);

    let created = 0;
    for (const r of rows) {
      const recent   = parseFloat(r.recent_rate);
      const baseline = parseFloat(r.baseline_rate);
      const drop     = Math.round(baseline - recent);
      const severity: InsightSeverity = drop >= 50 ? 'high' : drop >= 40 ? 'medium' : 'low';

      const existing = await tenantQuery(schema, `
        SELECT id FROM ${schema}.ai_insights
        WHERE  type = 'attendance_drop' AND student_id = $1
          AND  resolved_at IS NULL
          AND  created_at >= CURRENT_DATE - INTERVAL '7 days'
      `, [r.student_id]);

      if (existing.length) continue;

      await tenantQuery(schema, `
        INSERT INTO ${schema}.ai_insights (type, severity, student_id, message, metadata)
        VALUES ('attendance_drop', $1, $2, $3, $4)
      `, [
        severity, r.student_id,
        `${r.full_name}'s attendance dropped from ${baseline}% to ${recent}% in the last 2 weeks`,
        JSON.stringify({ recent_rate: recent, baseline_rate: baseline, drop }),
      ]);
      created++;
    }
    return created;
  }

  // ── Chronic absenteeism detector ──────────────────────────────────────────
  // Flags students absent >25% in rolling 30 days.
  async detectChronicAbsenteeism(schema: string): Promise<number> {
    const rows = await tenantQuery<{
      student_id: string; full_name: string; absent_rate: string; absent_days: string;
    }>(schema, `
      SELECT s.id AS student_id,
             TRIM(s.first_name || ' ' || s.last_name) AS full_name,
             ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'absent') / NULLIF(COUNT(*), 0), 1) AS absent_rate,
             COUNT(*) FILTER (WHERE a.status = 'absent')::text AS absent_days
      FROM   ${schema}.students s
      JOIN   ${schema}.attendance a ON a.student_id = s.id
      WHERE  s.is_active = true
        AND  a.date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP  BY s.id, s.first_name, s.last_name
      HAVING COUNT(*) >= 15
         AND 100.0 * COUNT(*) FILTER (WHERE a.status = 'absent') / NULLIF(COUNT(*), 0) > 25
    `);

    let created = 0;
    for (const r of rows) {
      const existing = await tenantQuery(schema, `
        SELECT id FROM ${schema}.ai_insights
        WHERE  type = 'chronic_absenteeism' AND student_id = $1
          AND  resolved_at IS NULL
          AND  created_at >= CURRENT_DATE - INTERVAL '7 days'
      `, [r.student_id]);

      if (existing.length) continue;

      const rate     = parseFloat(r.absent_rate);
      const severity: InsightSeverity = rate >= 40 ? 'high' : rate >= 30 ? 'medium' : 'low';

      await tenantQuery(schema, `
        INSERT INTO ${schema}.ai_insights (type, severity, student_id, message, metadata)
        VALUES ('chronic_absenteeism', $1, $2, $3, $4)
      `, [
        severity, r.student_id,
        `${r.full_name} has been absent ${r.absent_days} days (${r.absent_rate}%) in the last 30 days`,
        JSON.stringify({ absent_rate: rate, absent_days: parseInt(r.absent_days) }),
      ]);
      created++;
    }
    return created;
  }

  // ── Fee default risk ───────────────────────────────────────────────────────
  // Scores students based on: days overdue, prior late payments, partial payments.
  async detectFeeDefaultRisk(schema: string): Promise<number> {
    const rows = await tenantQuery<{
      student_id: string; full_name: string;
      overdue_count: string; max_days_overdue: string; total_overdue: string;
    }>(schema, `
      SELECT s.id AS student_id,
             TRIM(s.first_name || ' ' || s.last_name) AS full_name,
             COUNT(*)::text                                  AS overdue_count,
             MAX(CURRENT_DATE - i.due_date)::text           AS max_days_overdue,
             SUM(i.total - COALESCE(i.paid_amount, 0))::text AS total_overdue
      FROM   ${schema}.fee_invoices i
      JOIN   ${schema}.students s ON s.id = i.student_id
      WHERE  i.status IN ('pending', 'partial')
        AND  i.due_date < CURRENT_DATE
        AND  s.is_active = true
      GROUP  BY s.id, s.first_name, s.last_name
      HAVING MAX(CURRENT_DATE - i.due_date) >= 7
    `);

    let created = 0;
    for (const r of rows) {
      const daysOverdue = parseInt(r.max_days_overdue);
      const severity: InsightSeverity =
        daysOverdue >= 30 ? 'high' : daysOverdue >= 14 ? 'medium' : 'low';

      const existing = await tenantQuery(schema, `
        SELECT id FROM ${schema}.ai_insights
        WHERE  type = 'fee_default_risk' AND student_id = $1
          AND  resolved_at IS NULL
          AND  created_at >= CURRENT_DATE - INTERVAL '3 days'
      `, [r.student_id]);

      if (existing.length) continue;

      await tenantQuery(schema, `
        INSERT INTO ${schema}.ai_insights (type, severity, student_id, message, metadata)
        VALUES ('fee_default_risk', $1, $2, $3, $4)
      `, [
        severity, r.student_id,
        `${r.full_name} has ${r.overdue_count} overdue invoice(s) totalling ₹${parseInt(r.total_overdue).toLocaleString('en-IN')} (${daysOverdue} days overdue)`,
        JSON.stringify({
          overdue_count:    parseInt(r.overdue_count),
          max_days_overdue: daysOverdue,
          total_overdue:    parseInt(r.total_overdue),
        }),
      ]);
      created++;
    }
    return created;
  }

  // ── Run all detectors for one tenant schema ───────────────────────────────
  async runForSchema(schema: string): Promise<{ schema: string; insights: number }> {
    await this.ensureTable(schema);
    const [a, b, c] = await Promise.all([
      this.detectAttendanceDrop(schema),
      this.detectChronicAbsenteeism(schema),
      this.detectFeeDefaultRisk(schema),
    ]);
    const total = a + b + c;
    if (total > 0) logger.info(`[AI Insights] ${schema}: +${a} attendance_drop, +${b} chronic, +${c} fee_risk`);
    return { schema, insights: total };
  }

  // ── Run across all active tenants (called by cron) ───────────────────────
  async runAllTenants(): Promise<void> {
    const tenants = await query<{ schema_name: string }>(
      `SELECT schema_name FROM public.tenants WHERE is_active = true`
    );
    logger.info(`[AI Insights] Starting nightly run across ${tenants.length} tenants`);
    for (const t of tenants) {
      try {
        await this.runForSchema(t.schema_name);
      } catch (err) {
        logger.error(`[AI Insights] Failed for schema ${t.schema_name}`, err);
      }
    }
    logger.info('[AI Insights] Nightly run complete');
  }
}

export const insightsService = new InsightsService();
