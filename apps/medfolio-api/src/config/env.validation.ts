export interface EnvironmentVariables {
  DATABASE_URL: string;
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  CORS_ORIGIN?: string;
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

  return {
    ...config,
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnv as EnvironmentVariables['NODE_ENV'],
    PORT: port,
    CORS_ORIGIN: typeof config.CORS_ORIGIN === 'string' ? config.CORS_ORIGIN : undefined,
  };
}
