import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Runtime secret loading. Secret VALUES never live in the repository.
// In development, values are loaded from backend/.env or .env.
// In production the values are injected by the managed secret store.

export const REQUIRED_SECRET_KEYS = [
  'TL_SESSION_PEPPER',
  'TL_AUDIT_HMAC_KEY',
  'TL_FIELD_ENCRYPTION_KEK',
  'TL_PHONE_HMAC_KEY',
  'TL_DATABASE_URL',
  'TL_SETUP_SECRET',
] as const;

export type SecretKey = (typeof REQUIRED_SECRET_KEYS)[number];

export interface SecretStore {
  get(key: SecretKey): string;
}

export class SecretNotFoundError extends Error {
  constructor(key: SecretKey) {
    // Names only; never include a value.
    super(`Missing required secret: ${key}`);
    this.name = 'SecretNotFoundError';
  }
}

function loadEnvFileIfPresent(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'backend', '.env'),
    resolve(process.cwd(), '..', '.env'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const content = readFileSync(candidate, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (!(key in process.env)) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // ignore read error
      }
    }
  }
}

export function createEnvSecretStore(env: NodeJS.ProcessEnv = process.env): SecretStore {
  loadEnvFileIfPresent();
  return {
    get(key: SecretKey): string {
      const value = env[key] ?? process.env[key];
      // For local zero-setup execution, if TL_DATABASE_URL is not provided or empty,
      // safely fallback to 'embedded' so tutors can run without requiring local Postgres.
      if (key === 'TL_DATABASE_URL' && (!value || value.trim() === '')) {
        return 'embedded';
      }
      if (value === undefined || value.trim() === '') {
        throw new SecretNotFoundError(key);
      }
      return value;
    },
  };
}

export function assertSecretsPresent(store: SecretStore): void {
  for (const key of REQUIRED_SECRET_KEYS) {
    store.get(key);
  }
}
