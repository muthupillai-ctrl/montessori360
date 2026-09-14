import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { getPool } from '../../services/sis-usage.js';

export const aiUsageRouter = Router();
aiUsageRouter.use(authenticate);

aiUsageRouter.get('/', async (req: Request, res: Response) => {
  const schema = req.user!.tenantSchema;
  const pool   = getPool();

  if (!pool) {
    res.json({ data: { total_calls: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0, by_feature: [], daily: [] } });
    return;
  }

  const [totals] = (await pool.query(
    `SELECT COUNT(*)::text AS total_calls,
            COALESCE(SUM(input_tokens),0)::text  AS total_input,
            COALESCE(SUM(output_tokens),0)::text AS total_output,
            COALESCE(SUM(cost_usd),0)::text      AS total_cost
     FROM public.ai_usage_log WHERE tenant_schema = $1`,
    [schema]
  )).rows;

  const byFeature = (await pool.query(
    `SELECT feature,
            COUNT(*)::text      AS calls,
            SUM(cost_usd)::text AS cost_usd
     FROM public.ai_usage_log
     WHERE tenant_schema = $1
     GROUP BY feature ORDER BY SUM(cost_usd) DESC`,
    [schema]
  )).rows;

  const daily = (await pool.query(
    `SELECT to_char(d.day,'YYYY-MM-DD') AS date,
            COALESCE(COUNT(l.id),0)::text       AS calls,
            COALESCE(SUM(l.cost_usd),0)::text   AS cost_usd
     FROM generate_series(
            (NOW()-INTERVAL '29 days')::date,
            NOW()::date, '1 day'::interval
          ) AS d(day)
     LEFT JOIN public.ai_usage_log l
            ON to_char(l.created_at AT TIME ZONE 'UTC','YYYY-MM-DD') = to_char(d.day,'YYYY-MM-DD')
           AND l.tenant_schema = $1
     GROUP BY d.day ORDER BY d.day`,
    [schema]
  )).rows;

  res.json({
    data: {
      total_calls:         parseInt(totals.total_calls),
      total_input_tokens:  parseInt(totals.total_input),
      total_output_tokens: parseInt(totals.total_output),
      total_cost_usd:      parseFloat(totals.total_cost),
      by_feature: byFeature.map((r: any) => ({ feature: r.feature, calls: parseInt(r.calls), cost_usd: parseFloat(r.cost_usd) })),
      daily:      daily.map((r: any)      => ({ date: r.date,       calls: parseInt(r.calls), cost_usd: parseFloat(r.cost_usd) })),
    },
  });
});
