import fs from 'fs';
import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';


let pool: Pool;

export function getPool(): Pool {
  if (!pool) throw new Error('Database not connected. Call connectDatabase() first.');
  return pool;
}

export async function connectDatabase(): Promise<void> {
  if (!process.env.DB_CERT_PATH) {
    throw new Error('DB_CERT_PATH is not configured');
  }

pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min: 0,
  max: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
  idleTimeoutMillis: 5_000,        // close idle connections before Aiven LB kills them
  connectionTimeoutMillis: 15_000,
  keepAlive: false,                 // don't bother — we close idle connections quickly anyway
  ssl: {
    rejectUnauthorized: false,
    ca: fs.readFileSync(process.env.DB_CERT_PATH).toString(),
  },
});

  //pool = new Pool({
   // connectionString: process.env.DATABASE_URL,
   // min: parseInt(process.env.DATABASE_POOL_MIN ?? '2', 10),
   // max: parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
   // idleTimeoutMillis: 30_000,
   // connectionTimeoutMillis: 5_000,
   // ...sslConfig,
  //});

  pool.on('error', (err: any) => {
    // ETIMEDOUT / ECONNRESET are expected when Aiven's LB drops idle connections
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
      logger.warn(`PostgreSQL pool: idle connection dropped by server (${err.code})`);
    } else {
      logger.error('Unexpected PostgreSQL pool error', err);
    }
  });

  // Verify connection
  const client = await pool.connect();
  const result = await client.query('SELECT version()');
  client.release();
  logger.info(`✅ PostgreSQL connected: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
}

/**
 * Execute a query in the default (public) schema.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

/**
 * Execute a query scoped to a specific tenant schema.
 * Sets search_path for the duration of the client checkout.
 */
export async function tenantQuery<T = Record<string, unknown>>(
  tenantSchema: string,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query(`SET search_path TO ${tenantSchema}, public`);
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * Run multiple queries in a single tenant-scoped transaction.
 */
export async function tenantTransaction<T>(
  tenantSchema: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query(`SET search_path TO ${tenantSchema}, public`);
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
