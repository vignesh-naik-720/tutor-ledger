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
