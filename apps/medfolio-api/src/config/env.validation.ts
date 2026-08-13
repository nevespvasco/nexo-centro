export interface EnvironmentVariables {
  DATABASE_URL: string;
  PORT?: string;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  if (!config.DATABASE_URL || typeof config.DATABASE_URL !== 'string') {
    throw new Error('DATABASE_URL is required');
  }
  return config as unknown as EnvironmentVariables;
}
