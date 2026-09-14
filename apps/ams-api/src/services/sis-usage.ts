import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8':   { input: 5.00,  output: 25.00 },
  'claude-opus-4-7':   { input: 5.00,  output: 25.00 },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':  { input: 1.00,  output: 5.00  },
};

function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { input: 5.00, output: 25.00 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (pool) return pool;
  const url = process.env['DATABASE_URL'];
  if (!url) {
    logger.warn('[sis-usage] DATABASE_URL not set — AMS AI usage will NOT be logged to SIS DB');
    return null;
  }

  logger.info('[sis-usage] Connecting to SIS DB for AI usage logging');
  const cleanUrl = url.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
  pool = new Pool({
    connectionString: cleanUrl,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
    min: 0,
    max: 2,
    idleTimeoutMillis: 10_000,
  });
  pool.on('error', (err: any) => {
    logger.warn(`[sis-usage] Pool error: ${err.message}`);
  });
  return pool;
}

export async function logAmsUsage(opts: {
  tenantSchema: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const p = getPool();
  if (!p) return;

  try {
    const cost = computeCost(opts.model, opts.inputTokens, opts.outputTokens);
    logger.debug(`[sis-usage] Logging: feature=${opts.feature} tenant=${opts.tenantSchema} in=${opts.inputTokens} out=${opts.outputTokens} cost=$${cost.toFixed(6)}`);
    await p.query(
      `INSERT INTO public.ai_usage_log (tenant_schema, feature, model, input_tokens, output_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [opts.tenantSchema, opts.feature, opts.model, opts.inputTokens, opts.outputTokens, cost]
    );
    logger.info(`[sis-usage] ✅ Logged ${opts.feature} for ${opts.tenantSchema} — $${cost.toFixed(6)}`);
  } catch (err: any) {
    logger.error(`[sis-usage] ❌ Failed to log to SIS DB: ${err.message}`);
  }
}
