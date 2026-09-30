import { buildKeyRing } from '@nexo-centro/db';

export interface EnvironmentVariables {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  CORS_ORIGIN?: string;
  APP_ENCRYPTION_KEY?: string;
  APP_ENCRYPTION_KEY_VERSION?: number;
  APP_ENCRYPTION_KEYS_RETIRED?: string;
  JWT_SECRET?: string;
  JWT_EXPIRES_IN: string;
  TWO_FACTOR_CHALLENGE_TTL: string;
  FRONTEND_URL: string;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  STORAGE_DIR?: string;
}

const NODE_ENVS = ['development', 'test', 'production'] as const;

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
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
      `NODE_ENV must be one of ${NODE_ENVS.join(', ')} (got "${displayValue(nodeEnv)}")`,
    );
  }

  let port = 3001;
  if (config.PORT !== undefined) {
    port = Number(config.PORT);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(
        `PORT must be a valid port number (got "${displayValue(config.PORT)}")`,
      );
    }
  }

  // AES-256 key (base64 of 32 bytes) used to encrypt secrets at rest, e.g. the
  // 2FA `two_factor_secret`, plus its version and any retired keys. The whole
  // key ring is parsed and validated by the shared buildKeyRing() exported from
  // @nexo-centro/db, so the accepted format never drifts between this boot-time
  // check and the crypto runtime. Required in production; optional elsewhere so
  // local dev without 2FA still boots.
  const encryptionKey =
    typeof config.APP_ENCRYPTION_KEY === 'string' &&
    config.APP_ENCRYPTION_KEY !== ''
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
          `APP_ENCRYPTION_KEY_VERSION must be a positive integer (got "${displayValue(versionRaw)}")`,
        );
      }
    }
  }

  // Signing secret for session/challenge JWTs (cookies). Required in
  // production, same rationale as APP_ENCRYPTION_KEY — local dev without auth
  // configured should still boot.
  const jwtSecret =
    typeof config.JWT_SECRET === 'string' && config.JWT_SECRET !== ''
      ? config.JWT_SECRET
      : undefined;
  if (!jwtSecret && nodeEnv === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  if (
    nodeEnv === 'production' &&
    jwtSecret &&
    Buffer.byteLength(jwtSecret, 'utf8') < 32
  ) {
    throw new Error('JWT_SECRET must contain at least 32 bytes in production');
  }

  const jwtExpiresIn =
    typeof config.JWT_EXPIRES_IN === 'string' && config.JWT_EXPIRES_IN !== ''
      ? config.JWT_EXPIRES_IN
      : '7d';

  const twoFactorChallengeTtl =
    typeof config.TWO_FACTOR_CHALLENGE_TTL === 'string' &&
    config.TWO_FACTOR_CHALLENGE_TTL !== ''
      ? config.TWO_FACTOR_CHALLENGE_TTL
      : '5m';

  if (nodeEnv === 'production' && !stringOrUndefined(config.FRONTEND_URL)) {
    throw new Error('FRONTEND_URL is required in production');
  }
  const frontendUrl = normalizeHttpUrl(
    stringOrUndefined(config.FRONTEND_URL) ?? 'http://localhost:5173',
    'FRONTEND_URL',
    nodeEnv === 'production',
  );
  const corsOrigin = normalizeCorsOrigins(
    stringOrUndefined(config.CORS_ORIGIN),
    nodeEnv === 'production',
  );

  const smtpHost = stringOrUndefined(config.SMTP_HOST);
  const smtpUser = stringOrUndefined(config.SMTP_USER);
  const smtpPassword = stringOrUndefined(config.SMTP_PASSWORD);
  const smtpFrom = stringOrUndefined(config.SMTP_FROM);
  const smtpPort =
    config.SMTP_PORT === undefined ? 587 : Number(config.SMTP_PORT);
  const smtpSecure = parseBoolean(config.SMTP_SECURE, 'SMTP_SECURE');
  if (!Number.isInteger(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }
  if (nodeEnv === 'production' && (!smtpHost || !smtpFrom)) {
    throw new Error('SMTP_HOST and SMTP_FROM are required in production');
  }
  if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }

  return {
    ...config,
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: port,
    CORS_ORIGIN: corsOrigin,
    APP_ENCRYPTION_KEY:
      typeof encryptionKey === 'string' ? encryptionKey : undefined,
    APP_ENCRYPTION_KEY_VERSION: encryptionKeyVersion,
    APP_ENCRYPTION_KEYS_RETIRED:
      typeof encryptionKeysRetired === 'string'
        ? encryptionKeysRetired
        : undefined,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    TWO_FACTOR_CHALLENGE_TTL: twoFactorChallengeTtl,
    FRONTEND_URL: frontendUrl,
    SMTP_HOST: smtpHost,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: smtpSecure,
    SMTP_USER: smtpUser,
    SMTP_PASSWORD: smtpPassword,
    SMTP_FROM: smtpFrom,
    STORAGE_DIR:
      typeof config.STORAGE_DIR === 'string' && config.STORAGE_DIR !== ''
        ? config.STORAGE_DIR
        : './storage',
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function parseBoolean(value: unknown, name: string): boolean {
  if (value === undefined || value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  throw new Error(`${name} must be true or false`);
}

function displayValue(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return typeof value;
}

function normalizeHttpUrl(
  value: string,
  name: string,
  requireHttps: boolean,
): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http:// or https://`);
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https:// in production`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not contain credentials`);
  }
  return value.replace(/\/+$/, '');
}

function normalizeCorsOrigins(
  value: string | undefined,
  requireHttps: boolean,
): string | undefined {
  if (!value) return undefined;
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      if (origin === '*') throw new Error('CORS_ORIGIN must not contain *');
      const normalized = normalizeHttpUrl(origin, 'CORS_ORIGIN', requireHttps);
      const parsed = new URL(normalized);
      if (parsed.origin !== normalized) {
        throw new Error('CORS_ORIGIN entries must contain only an origin');
      }
      return parsed.origin;
    });
  return origins.length > 0 ? [...new Set(origins)].join(',') : undefined;
}
