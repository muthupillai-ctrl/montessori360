#!/bin/bash
# Create/update AMS tables for every SIS tenant, inside the running AMS container.
#
# AMS has no migration files: provisionTenant() (apps/ams-api/src/config/database.ts)
# creates the tenant schema, applies all tables with IF NOT EXISTS and seeds the
# default curriculum. The API also does this lazily on a tenant's first request;
# this script just runs it up front for all tenants listed in the SIS database.
# Safe to re-run.
# Usage:
#   ./scripts/migrate-ams.sh              — all SIS tenants
#   ./scripts/migrate-ams.sh tenant_pvns  — specific schemas
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

CONTAINER=montessori360-ams-api

echo "🗄  Provisioning AMS tenant schemas via $SERVER:$CONTAINER"

remote "docker exec -i $CONTAINER node --input-type=module - $*" <<'NODE'
import pg from 'pg';
import { connectDatabase, provisionTenant, getPool } from '/app/dist/apps/ams-api/src/config/database.js';

let schemas = process.argv.slice(2);
if (schemas.length === 0) {
  const sisUrl = process.env.DATABASE_URL;
  if (!sisUrl) throw new Error('DATABASE_URL (SIS) not set — pass schema names explicitly');
  const sis = new pg.Client({
    connectionString: sisUrl.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: sisUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await sis.connect();
  const { rows } = await sis.query('SELECT schema_name FROM public.tenants ORDER BY schema_name');
  await sis.end();
  schemas = rows.map(r => r.schema_name);
}

await connectDatabase();
for (const schema of schemas) {
  if (!/^tenant_[a-z0-9_]+$/.test(schema)) throw new Error(`Refusing unexpected schema name: ${schema}`);
  await provisionTenant(schema);
  const { rows } = await getPool().query(
    `SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = $1`, [schema]);
  console.log(`  ✓ ${schema} (${rows[0].tables} tables)`);
}
await getPool().end();
NODE

echo "✅ AMS schemas up to date"
