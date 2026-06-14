/**
 * scripts/create-platform-admin.js
 *
 * Creates the first (or any) platform admin account.
 *
 * Usage:
 *   node scripts/create-platform-admin.js \
 *     --name "Super Admin" \
 *     --email "admin@montessori360.in" \
 *     --password "changeme123"
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const sslConfig = process.env.DATABASE_URL?.includes('aivencloud.com')
  ? { ssl: { rejectUnauthorized: false } }
  : {};

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ...sslConfig });

async function main() {
  const args = parseArgs();
  const hash = await bcrypt.hash(args.password, 12);

  const client = await pool.connect();
  try {
    const { rows: [admin] } = await client.query(
      `INSERT INTO public.platform_admins (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             name          = EXCLUDED.name,
             updated_at    = now()
       RETURNING id, email, name`,
      [args.email.toLowerCase(), hash, args.name]
    );
    console.log('✅ Platform admin ready');
    console.log(`   ID:    ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name:  ${admin.name}`);
    console.log('');
    console.log('   Login at: /platform/login');
  } finally {
    client.release();
    await pool.end();
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : null; };
  const name     = get('--name');
  const email    = get('--email');
  const password = get('--password');
  if (!name || !email || !password) {
    console.error('Usage: node create-platform-admin.js --name <name> --email <email> --password <password>');
    process.exit(1);
  }
  return { name, email, password };
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
