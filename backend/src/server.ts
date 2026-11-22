import { createEnvSecretStore } from './config/secrets.js';
import { getPool } from './db/client.js';
import { buildApp } from './app.js';

// Server entry point (T003, Phase 1)
const secretStore = createEnvSecretStore();

const dbUrl = secretStore.get('TL_DATABASE_URL');
const pepper = secretStore.get('TL_SESSION_PEPPER');
const auditHmacKey = secretStore.get('TL_AUDIT_HMAC_KEY');
const phoneHmacKey = secretStore.get('TL_PHONE_HMAC_KEY');
const fieldKeyHex = secretStore.get('TL_FIELD_ENCRYPTION_KEK');
const setupSecret = secretStore.get('TL_SETUP_SECRET');

// Convert field key hex into 32-byte Buffer for AES-256
const fieldKey = Buffer.from(fieldKeyHex.padEnd(64, '0').slice(0, 64), 'hex');

// Initialize database pool (or embedded fallback if offline)
getPool(dbUrl);

// If running with PostgreSQL (e.g. in Docker), apply schema migrations and auto-seed sample data if fresh
if (dbUrl && dbUrl.startsWith('postgres')) {
  try {
    const { runMigrations } = await import('./db/migrate.js');
    await runMigrations(dbUrl);
    console.log('✅ PostgreSQL migrations applied successfully.');

    // Auto-seed demo owner and sample data if database is brand new
    const { query } = await import('./db/client.js');
    const owners = await query<{ id: string; ledger_id: string }>('SELECT id, ledger_id FROM owner_account LIMIT 1');
    if (owners.length === 0) {
      const { randomUUID } = await import('node:crypto');
      const { hashPassword } = await import('./auth/password.js');
      const { loadSampleData } = await import('./domain/sampleData.js');

      const ledgerId = randomUUID();
      const ownerId = randomUUID();
      const pwHash = await hashPassword('Password123456', pepper);

      await query(
        `INSERT INTO ledger (id, currency_code, currency_exponent, owner_timezone, minimum_balance_minor, opening_balance_minor, is_sample_data)
         VALUES ($1, 'INR', 2, 'Asia/Kolkata', 2000000, 3500000, TRUE)`,
        [ledgerId],
      );

      await query(
        `INSERT INTO owner_account (id, ledger_id, password_hash, failed_login_count, session_idle_minutes, created_at)
         VALUES ($1, $2, $3, 0, 15, now())`,
        [ownerId, ledgerId, pwHash],
      );

      await loadSampleData(ledgerId, fieldKey);
      console.log('🎉 Fresh PostgreSQL initialized with Demo Owner (Password123456) and 12 sample families.');
    }
  } catch (err: any) {
    console.warn('⚠️ Notice: Could not run migrations or auto-seed on startup:', err.message);
  }
}

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

const app = buildApp({
  deps: {
    fieldKey,
    phoneHmacKey,
    auditHmacKey,
    pepper,
  },
  setupSecret,
});

app.listen({ port, host }, (err, address) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🚀 Tutor Ledger API listening at ${address}`);
  console.log(`📡 Ready for home tutors to record, chase, forecast and manage cash flow.`);
});
