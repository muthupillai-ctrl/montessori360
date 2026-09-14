/**
 * Quick test: can AMS API write to SIS DB ai_usage_log?
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node test-sis-usage.js
 *
 * Or if .env is configured:
 *   node -r dotenv/config test-sis-usage.js
 */

import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

console.log('DATABASE_URL host:', new URL(DATABASE_URL).hostname);

// Strip sslmode from URL — handled via pool config to avoid pg overriding rejectUnauthorized
const cleanUrl = DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
const isLocal = DATABASE_URL.includes('localhost');

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // 1 — confirm connection
    const { rows: [ver] } = await client.query('SELECT version()');
    console.log('✅ Connected to SIS DB:', ver.version.split(' ').slice(0, 2).join(' '));

    // 2 — confirm table exists
    const { rows: [tbl] } = await client.query(`
      SELECT to_regclass('public.ai_usage_log') AS tbl
    `);
    if (!tbl.tbl) {
      console.error('❌ public.ai_usage_log table does not exist — run migrations first');
      return;
    }
    console.log('✅ public.ai_usage_log table exists');

    // 3 — insert test row
    const { rows: [row] } = await client.query(`
      INSERT INTO public.ai_usage_log (tenant_schema, feature, model, input_tokens, output_tokens, cost_usd)
      VALUES ('tenant_ams_test', 'ams_worksheet_generate', 'claude-opus-4-8', 324, 1959, 0.050595)
      RETURNING id, created_at
    `);
    console.log('✅ Test row inserted — id:', row.id, 'at:', row.created_at);

    // 4 — read it back
    const { rows: [check] } = await client.query(`
      SELECT tenant_schema, feature, model, input_tokens, output_tokens, cost_usd::text
      FROM public.ai_usage_log
      WHERE id = $1
    `, [row.id]);
    console.log('✅ Row verified:', check);

    // 5 — clean up test row
    await client.query(`DELETE FROM public.ai_usage_log WHERE id = $1`, [row.id]);
    console.log('✅ Test row cleaned up');

    console.log('\n✅ All checks passed — AMS can write to SIS ai_usage_log');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
