// @ts-ignore - pg types not available
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * PostgreSQL access. The pool is created lazily so builds and health checks can
 * load this module without a database connection string. No insecure fallback
 * credentials are used.
 */
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured to access the database.');
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  pool.on('error', (err: Error) => {
    console.error('[DB] Unexpected error on idle client', err);
  });

  return pool;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    await client.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  } finally {
    client?.release();
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 100)}...`);
    }
    return result;
  } catch (error) {
    console.error('[DB] Query error:', { text: text.substring(0, 100), error });
    throw error;
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export default {
  get query() {
    return getPool();
  },
};
