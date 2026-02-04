// @ts-ignore - pg types not available
import { Pool, PoolClient, QueryResult } from 'pg';

// Parse DATABASE_URL to extract connection details for pool configuration
function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname || 'localhost',
      port: parseInt(urlObj.port || '5432', 10),
      database: urlObj.pathname.replace('/', ''),
      user: urlObj.username,
      password: urlObj.password
    };
  } catch {
    // Fallback for invalid URLs
    return {
      host: 'localhost',
      port: 5432,
      database: 'musicapp',
      user: 'musicuser',
      password: 'yourpassword'
    };
  }
}

// Build pool configuration for local development
const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL || 'postgresql://musicuser:yourpassword@localhost:5432/musicapp');

const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  // Connection pool settings optimized for local development
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection can't be established
  // Keep alive to prevent connection timeouts
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Log pool errors for debugging
pool.on('error', (err: Error) => {
  console.error('[DB] Unexpected error on idle client', err);
});

// Health check function for monitoring
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  }
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const client = await pool.connect();
    const result = await client.query(text, params);
    client.release();
    
    // Log slow queries (>100ms)
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 100)}...`);
    }
    
    return result;
  } catch (error) {
    console.error('[DB] Query error:', { text: text.substring(0, 100), error });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
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

// Graceful shutdown
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('[DB] Pool closed gracefully');
}

export default pool;
