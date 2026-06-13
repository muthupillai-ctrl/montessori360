/**
 * scripts/provision-tenant.js
 *
 * Creates a new tenant in the public.tenants table and provisions
 * its dedicated PostgreSQL schema via the create_tenant_schema() function.
 *
 * Usage:
 *   node scripts/provision-tenant.js \
 *     --code sunshine123 \
 *     --name "Sunshine Montessori School" \
 *     --owner-name "Priya Nair" \
 *     --owner-email "priya@sunshine.edu.in" \
 *     --plan starter
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const sslConfig = process.env.DATABASE_URL?.includes('aivencloud.com')
  ? { ssl: { rejectUnauthorized: false } }
  : {};

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ...sslConfig });

async function main() {
  const args = parseArgs();
  const schemaName = `tenant_${args.code.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Resolve plan
    const { rows: [plan] } = await client.query(
      `SELECT id FROM subscription_plans WHERE name = $1`, [args.plan ?? 'starter']
    );
    if (!plan) throw new Error(`Plan '${args.plan}' not found`);

    // 2. Insert tenant record
    const tenantId = uuidv4();
    await client.query(`
      INSERT INTO public.tenants
        (id, code, name, schema_name, subscription_plan_id, owner_name, owner_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [tenantId, args.code, args.name, schemaName, plan.id, args.ownerName, args.ownerEmail]);

    // 3. Provision schema
    await client.query(`SELECT public.create_tenant_schema($1)`, [schemaName]);

    // 4. Seed default Montessori class structure
    await client.query(`SELECT public.seed_default_classes($1)`, [schemaName]);

    await client.query('COMMIT');

    console.log('✅ Tenant provisioned successfully');
    console.log(`   ID:          ${tenantId}`);
    console.log(`   Code:        ${args.code}`);
    console.log(`   Schema:      ${schemaName}`);
    console.log(`   Plan:        ${args.plan ?? 'starter'}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Provisioning failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : null;
  };
  const code      = get('--code');
  const name      = get('--name');
  const ownerName = get('--owner-name');
  const ownerEmail= get('--owner-email');
  const plan      = get('--plan') ?? 'starter';

  if (!code || !name || !ownerName || !ownerEmail) {
    console.error('Usage: node provision-tenant.js --code <code> --name <name> --owner-name <name> --owner-email <email> [--plan starter|growth|enterprise]');
    process.exit(1);
  }
  return { code, name, ownerName, ownerEmail, plan };
}

main();
