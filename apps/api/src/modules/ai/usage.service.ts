import { query } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8':   { input: 5.00,  output: 25.00  },
  'claude-opus-4-7':   { input: 5.00,  output: 25.00  },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00  },
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00   },
};

function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { input: 5.00, output: 25.00 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

class UsageService {

  async ensureTable(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS public.ai_usage_log (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_schema TEXT        NOT NULL,
        feature       TEXT        NOT NULL,
        model         TEXT        NOT NULL,
        input_tokens  INTEGER     NOT NULL DEFAULT 0,
        output_tokens INTEGER     NOT NULL DEFAULT 0,
        cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS ai_usage_log_schema_idx ON public.ai_usage_log (tenant_schema)`);
    await query(`CREATE INDEX IF NOT EXISTS ai_usage_log_created_idx ON public.ai_usage_log (created_at)`);
  }

  async log(opts: {
    tenantSchema: string;
    feature:      string;
    model:        string;
    inputTokens:  number;
    outputTokens: number;
  }): Promise<void> {
    try {
      await this.ensureTable();
      const cost = computeCost(opts.model, opts.inputTokens, opts.outputTokens);
      await query(
        `INSERT INTO public.ai_usage_log (tenant_schema, feature, model, input_tokens, output_tokens, cost_usd)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [opts.tenantSchema, opts.feature, opts.model, opts.inputTokens, opts.outputTokens, cost]
      );
    } catch (err) {
      logger.error('Failed to log AI usage', { err });
    }
  }

  // ── Platform-level aggregates ───────────────────────────────────────────────

  async platformSummary(): Promise<{
    total_calls: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost_usd: number;
    by_school: Array<{ schema: string; calls: number; cost_usd: number }>;
    by_feature: Array<{ feature: string; calls: number; cost_usd: number }>;
    daily: Array<{ date: string; calls: number; cost_usd: number }>;
  }> {
    await this.ensureTable();

    const [totals] = await query<{
      total_calls: string; total_input: string; total_output: string; total_cost: string;
    }>(`SELECT COUNT(*)::text            AS total_calls,
               SUM(input_tokens)::text  AS total_input,
               SUM(output_tokens)::text AS total_output,
               SUM(cost_usd)::text      AS total_cost
        FROM public.ai_usage_log`);

    const bySchool = await query<{ schema: string; calls: string; cost_usd: string }>(
      `SELECT tenant_schema AS schema,
              COUNT(*)::text      AS calls,
              SUM(cost_usd)::text AS cost_usd
       FROM   public.ai_usage_log
       GROUP  BY tenant_schema
       ORDER  BY SUM(cost_usd) DESC
       LIMIT  50`
    );

    const byFeature = await query<{ feature: string; calls: string; cost_usd: string }>(
      `SELECT feature,
              COUNT(*)::text      AS calls,
              SUM(cost_usd)::text AS cost_usd
       FROM   public.ai_usage_log
       GROUP  BY feature
       ORDER  BY SUM(cost_usd) DESC`
    );

    const daily = await query<{ date: string; calls: string; cost_usd: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD')    AS date,
              COALESCE(COUNT(l.id), 0)::text  AS calls,
              COALESCE(SUM(l.cost_usd), 0)::text AS cost_usd
       FROM   generate_series(
                (NOW() - INTERVAL '29 days')::date,
                NOW()::date,
                '1 day'::interval
              ) AS d(day)
       LEFT JOIN public.ai_usage_log l
              ON to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = to_char(d.day, 'YYYY-MM-DD')
       GROUP  BY d.day
       ORDER  BY d.day`
    );

    return {
      total_calls:         parseInt(totals?.total_calls  ?? '0'),
      total_input_tokens:  parseInt(totals?.total_input  ?? '0'),
      total_output_tokens: parseInt(totals?.total_output ?? '0'),
      total_cost_usd:      parseFloat(totals?.total_cost ?? '0'),
      by_school:  bySchool.map(r => ({ schema: r.schema, calls: parseInt(r.calls), cost_usd: parseFloat(r.cost_usd) })),
      by_feature: byFeature.map(r => ({ feature: r.feature, calls: parseInt(r.calls), cost_usd: parseFloat(r.cost_usd) })),
      daily:      daily.map(r => ({ date: r.date, calls: parseInt(r.calls), cost_usd: parseFloat(r.cost_usd) })),
    };
  }

  // ── School-level aggregates ─────────────────────────────────────────────────

  async schoolSummary(tenantSchema: string): Promise<{
    total_calls: number;
    total_cost_usd: number;
    by_feature: Array<{ feature: string; calls: number; cost_usd: number }>;
    daily: Array<{ date: string; calls: number; cost_usd: number }>;
  }> {
    await this.ensureTable();

    const [totals] = await query<{ total_calls: string; total_cost: string }>(
      `SELECT COUNT(*)::text      AS total_calls,
              SUM(cost_usd)::text AS total_cost
       FROM   public.ai_usage_log
       WHERE  tenant_schema = $1`,
      [tenantSchema]
    );

    const byFeature = await query<{ feature: string; calls: string; cost_usd: string }>(
      `SELECT feature,
              COUNT(*)::text      AS calls,
              SUM(cost_usd)::text AS cost_usd
       FROM   public.ai_usage_log
       WHERE  tenant_schema = $1
       GROUP  BY feature
       ORDER  BY SUM(cost_usd) DESC`,
      [tenantSchema]
    );

    const daily = await query<{ date: string; calls: string; cost_usd: string }>(
      `SELECT to_char(created_at, 'YYYY-MM-DD') AS date,
              COUNT(*)::text                    AS calls,
              SUM(cost_usd)::text               AS cost_usd
       FROM   public.ai_usage_log
       WHERE  tenant_schema = $1
         AND  created_at >= NOW() - INTERVAL '30 days'
       GROUP  BY to_char(created_at, 'YYYY-MM-DD')
       ORDER  BY date`,
      [tenantSchema]
    );

    return {
      total_calls:    parseInt(totals?.total_calls ?? '0'),
      total_cost_usd: parseFloat(totals?.total_cost ?? '0'),
      by_feature: byFeature.map(r => ({ feature: r.feature, calls: parseInt(r.calls), cost_usd: parseFloat(r.cost_usd) })),
      daily:      daily.map(r => ({ date: r.date, calls: parseInt(r.calls), cost_usd: parseFloat(r.cost_usd) })),
    };
  }
}

export const usageService = new UsageService();
