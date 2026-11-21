import { Pool, type QueryResultRow } from 'pg';

// Single pool for the API process. Every query goes through `query` with
// placeholders ($1, $2, ...). Callers must never build SQL by string concatenation.
let pool: Pool | null = null;

export function getPool(connectionString: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      // Database connections use TLS with full verification (plan.md, Transport).
      ssl: { rejectUnauthorized: true },
      max: 10,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  if (!pool) {
    throw new Error('Database pool not initialised');
  }
  const result = await pool.query<T>(text, [...params]);
  return result.rows;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
