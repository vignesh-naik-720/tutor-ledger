import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

// S-8: the application role can INSERT and SELECT audit rows but cannot UPDATE or DELETE them.
// Runs against a disposable PostgreSQL 16 where migrations are applied; the application role
// connection string is supplied via TL_TEST_APP_DATABASE_URL (key name only; never committed).
const url = process.env['TL_TEST_APP_DATABASE_URL'];

describe.skipIf(!url)('S-8 audit append-only', () => {
  it('denies UPDATE on audit_event for the application role', async () => {
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
    await client.connect();
    try {
      await expect(
        client.query("UPDATE audit_event SET action_code = 'X' WHERE false"),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await client.end();
    }
  });

  it('denies DELETE on audit_event for the application role', async () => {
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
    await client.connect();
    try {
      await expect(client.query('DELETE FROM audit_event WHERE false')).rejects.toThrow(
        /permission denied/i,
      );
    } finally {
      await client.end();
    }
  });
});
