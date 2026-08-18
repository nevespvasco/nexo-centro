import { buildKeyRing } from '@nexo-centro/db';

export interface EnvironmentVariables {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  CORS_ORIGIN?: string;
  APP_ENCRYPTION_KEY?: string;
  APP_ENCRYPTION_KEY_VERSION?: number;
  APP_ENCRYPTION_KEYS_RETIRED?: string;
}

const NODE_ENVS = ['development', 'test', 'production'] as const;

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid connection URL');
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new Error(
      `DATABASE_URL must be a postgres:// URL (got "${url.protocol}//…")`,
    );
  }

  const nodeEnv = config.NODE_ENV ?? 'development';
  if (!NODE_ENVS.includes(nodeEnv as (typeof NODE_ENVS)[number])) {
    throw new Error(
      `NODE_ENV must be one of ${NODE_ENVS.join(', ')} (got "${String(nodeEnv)}")`,
    );
  }

  let port = 3001;
  if (config.PORT !== undefined) {
    port = Number(config.PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(`PORT must be a valid port number (got "${String(config.PORT)}")`);
    }
  }

  // AES-256 key (base64 of 32 bytes) used to encrypt secrets at rest, e.g. the
  // 2FA `two_factor_secret`, plus its version and any retired keys. The whole
  // key ring is parsed and validated by the shared buildKeyRing() exported from
  // @nexo-centro/db, so the accepted format never drifts between this boot-time
  // check and the crypto runtime. Required in production; optional elsewhere so
  // local dev without 2FA still boots.
  const encryptionKey =
    typeof config.APP_ENCRYPTION_KEY === 'string' && config.APP_ENCRYPTION_KEY !== ''
      ? config.APP_ENCRYPTION_KEY
      : undefined;
  const encryptionKeysRetired =
    typeof config.APP_ENCRYPTION_KEYS_RETIRED === 'string' &&
    config.APP_ENCRYPTION_KEYS_RETIRED !== ''
      ? config.APP_ENCRYPTION_KEYS_RETIRED
      : undefined;

  let encryptionKeyVersion = 1;
  if (encryptionKey !== undefined) {
    const ring = buildKeyRing({
      key: encryptionKey,
      version: config.APP_ENCRYPTION_KEY_VERSION as string | number | undefined,
      retired: encryptionKeysRetired,
    });
    encryptionKeyVersion = ring.activeVersion;
  } else {
    if (nodeEnv === 'production') {
      throw new Error('APP_ENCRYPTION_KEY is required in production');
    }
    const versionRaw = config.APP_ENCRYPTION_KEY_VERSION;
    if (versionRaw !== undefined && versionRaw !== '') {
      encryptionKeyVersion = Number(versionRaw);
      if (!Number.isInteger(encryptionKeyVersion) || encryptionKeyVersion < 1) {
        throw new Error(
          `APP_ENCRYPTION_KEY_VERSION must be a positive integer (got "${String(versionRaw)}")`,
        );
      }
    }
  }

  return {
    ...config,
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: port,
    CORS_ORIGIN: typeof config.CORS_ORIGIN === 'string' ? config.CORS_ORIGIN : undefined,
    APP_ENCRYPTION_KEY: typeof encryptionKey === 'string' ? encryptionKey : undefined,
    APP_ENCRYPTION_KEY_VERSION: encryptionKeyVersion,
    APP_ENCRYPTION_KEYS_RETIRED:
      typeof encryptionKeysRetired === 'string' ? encryptionKeysRetired : undefined,
  };
}
