import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Client } = pg;

// Migrations run under the MIGRATION role, which is never used at request time.
// Files are applied in lexical order, once each, inside a transaction.

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(here, '..', '..', 'migrations');

export async function runMigrations(connectionString: string): Promise<string[]> {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE filename = $1',
        [file],
      );
      if (existing.rows.length > 0) {
        if (existing.rows[0]?.checksum !== checksum) {
          throw new Error(`Migration ${file} was modified after it was applied`);
        }
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const url = process.env['TL_MIGRATION_DATABASE_URL'];
  if (!url) {
    console.error('TL_MIGRATION_DATABASE_URL is not set (key name only; value comes from the secret store)');
    process.exit(1);
  }
  runMigrations(url)
    .then((files) => console.log(`Applied ${files.length} migration(s)`))
    .catch((err: unknown) => {
      console.error('Migration failed', err instanceof Error ? err.name : 'unknown');
      process.exit(1);
    });
}
