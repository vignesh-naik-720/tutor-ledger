import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

// S-9: the application role has no CREATE rights (no DDL). Runs against a disposable
// PostgreSQL 16 with migrations applied; connection string from TL_TEST_APP_DATABASE_URL.
const url = process.env['TL_TEST_APP_DATABASE_URL'];

describe.skipIf(!url)('S-9 app role has no CREATE TABLE', () => {
  it('denies CREATE TABLE for the application role', async () => {
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
    await client.connect();
    try {
      await expect(client.query('CREATE TABLE tl_should_not_exist (id int)')).rejects.toThrow(
        /permission denied/i,
      );
    } finally {
      await client.end();
    }
  });
});
