// Runtime secret loading. Secret VALUES never live in the repository.
// In production the values are injected by the managed secret store (for example as
// container secrets mounted into the process environment). Only key names are listed
// in backend/.env.example.

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

export function createEnvSecretStore(env: NodeJS.ProcessEnv = process.env): SecretStore {
  return {
    get(key: SecretKey): string {
      const value = env[key];
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
