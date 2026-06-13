#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../../..', '.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'src', 'migrations');
const direction = process.argv[2] ?? 'up';

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.pgmigrations (
        id      SERIAL PRIMARY KEY,
        name    VARCHAR(255) NOT NULL UNIQUE,
        run_on  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js'))
      .sort();

    if (direction === 'up') {
      const { rows } = await client.query('SELECT name FROM public.pgmigrations');
      const ran = new Set(rows.map(r => r.name));
      const pending = files.filter(f => !ran.has(f));

      if (pending.length === 0) { console.log('No pending migrations.'); return; }

      for (const file of pending) {
        console.log(`▶  ${file}`);
        const migration = require(path.join(MIGRATIONS_DIR, file));
        const sqls = [];
        await migration.up({ sql: (s) => sqls.push(s) });
        for (const sql of sqls) {
          await client.query(sql);
        }
        await client.query('INSERT INTO public.pgmigrations (name) VALUES ($1)', [file]);
        console.log(`✅ ${file}`);
      }
    } else {
      const { rows } = await client.query(
        'SELECT name FROM public.pgmigrations ORDER BY run_on DESC LIMIT 1'
      );
      if (rows.length === 0) { console.log('Nothing to roll back.'); return; }

      const file = rows[0].name;
      console.log(`▶  Rolling back: ${file}`);
      const migration = require(path.join(MIGRATIONS_DIR, file));
      const sqls = [];
      await migration.down({ sql: (s) => sqls.push(s) });
      for (const sql of sqls) {
        await client.query(sql);
      }
      await client.query('DELETE FROM public.pgmigrations WHERE name = $1', [file]);
      console.log(`✅ Rolled back: ${file}`);
    }

    console.log('\n🎉 Done!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
