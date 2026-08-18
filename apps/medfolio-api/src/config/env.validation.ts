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
  // 2FA `two_factor_secret`. Required in production; optional elsewhere so local
  // dev without 2FA still boots. Validated whenever present.
  const encryptionKey = config.APP_ENCRYPTION_KEY;
  if (encryptionKey !== undefined) {
    if (typeof encryptionKey !== 'string' || Buffer.from(encryptionKey, 'base64').length !== 32) {
      throw new Error(
        'APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key (generate with: openssl rand -base64 32)',
      );
    }
  } else if (nodeEnv === 'production') {
    throw new Error('APP_ENCRYPTION_KEY is required in production');
  }

  // Active key version, bumped when APP_ENCRYPTION_KEY is rotated. Defaults to 1.
  let encryptionKeyVersion = 1;
  const encryptionKeyVersionRaw = config.APP_ENCRYPTION_KEY_VERSION;
  if (encryptionKeyVersionRaw !== undefined && encryptionKeyVersionRaw !== '') {
    encryptionKeyVersion = Number(encryptionKeyVersionRaw);
    if (!Number.isInteger(encryptionKeyVersion) || encryptionKeyVersion < 1) {
      throw new Error(
        `APP_ENCRYPTION_KEY_VERSION must be a positive integer (got "${String(encryptionKeyVersionRaw)}")`,
      );
    }
  }

  // Retired keys kept only to decrypt data written before a key rotation, in
  // the format "1:<base64>,2:<base64>". Never used to encrypt new data.
  const encryptionKeysRetired = config.APP_ENCRYPTION_KEYS_RETIRED;
  if (encryptionKeysRetired !== undefined && encryptionKeysRetired !== '') {
    if (typeof encryptionKeysRetired !== 'string') {
      throw new Error('APP_ENCRYPTION_KEYS_RETIRED must be a string');
    }
    for (const entry of encryptionKeysRetired.split(',').map((e) => e.trim()).filter(Boolean)) {
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex === -1) {
        throw new Error(
          `APP_ENCRYPTION_KEYS_RETIRED entry must be "version:base64key" (got "${entry}")`,
        );
      }
      const versionStr = entry.slice(0, separatorIndex);
      const keyB64 = entry.slice(separatorIndex + 1);
      const version = Number(versionStr);
      if (!Number.isInteger(version) || version < 1) {
        throw new Error(`APP_ENCRYPTION_KEYS_RETIRED has an invalid version ("${versionStr}")`);
      }
      if (version === encryptionKeyVersion) {
        throw new Error(
          `APP_ENCRYPTION_KEYS_RETIRED cannot reuse the active key version (${encryptionKeyVersion})`,
        );
      }
      if (Buffer.from(keyB64, 'base64').length !== 32) {
        throw new Error(
          `APP_ENCRYPTION_KEYS_RETIRED key for version ${version} must decode to 32 bytes`,
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
