/**
 * scripts/reset-platform-admin-password.js
 *
 * Resets a platform admin password directly in the database.
 *
 * Usage:
 *   node scripts/reset-platform-admin-password.js \
 *     --email "admin@example.com" \
 *     --password "NewPassword123"
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../apps/api/.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
});

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((val, i, arr) => {
    if (val.startsWith('--')) args[val.slice(2)] = arr[i + 1];
  });
  if (!args.email || !args.password) {
    console.error('Usage: node reset-platform-admin-password.js --email <email> --password <newpassword>');
    process.exit(1);
  }
  return args;
}

async function main() {
  const { email, password } = parseArgs();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, email FROM public.platform_admins WHERE email = $1',
      [email.toLowerCase()]
    );
    if (!rows.length) {
      console.error(`No platform admin found with email: ${email}`);
      process.exit(1);
    }
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      'UPDATE public.platform_admins SET password_hash = $1, updated_at = now() WHERE email = $2',
      [hash, email.toLowerCase()]
    );
    console.log(`✅ Password reset for ${email}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
