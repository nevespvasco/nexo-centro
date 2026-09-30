import { validate } from './env.validation';

const productionConfig = {
  DATABASE_URL: 'postgresql://app:password@db:5432/app',
  NODE_ENV: 'production',
  APP_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  JWT_SECRET: 'a'.repeat(32),
  FRONTEND_URL: 'https://app.example.test/',
  CORS_ORIGIN: 'https://app.example.test/',
  SMTP_HOST: 'smtp.example.test',
  SMTP_FROM: 'no-reply@example.test',
};

describe('environment security validation', () => {
  it('normalizes explicit HTTPS origins', () => {
    const result = validate(productionConfig);

    expect(result.FRONTEND_URL).toBe('https://app.example.test');
    expect(result.CORS_ORIGIN).toBe('https://app.example.test');
  });

  it('rejects wildcard CORS with credentialed requests', () => {
    expect(() => validate({ ...productionConfig, CORS_ORIGIN: '*' })).toThrow(
      'CORS_ORIGIN must not contain *',
    );
  });

  it('requires HTTPS public URLs in production', () => {
    expect(() =>
      validate({
        ...productionConfig,
        FRONTEND_URL: 'http://app.example.test',
      }),
    ).toThrow('FRONTEND_URL must use https:// in production');
  });

  it('rejects weak JWT signing secrets in production', () => {
    expect(() =>
      validate({ ...productionConfig, JWT_SECRET: 'too-short' }),
    ).toThrow('JWT_SECRET must contain at least 32 bytes in production');
  });
});
