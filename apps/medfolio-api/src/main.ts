import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { csrfProtection } from './common/csrf.middleware';
import type { EnvironmentVariables } from './config/env.validation';

function parseCorsOrigins(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<EnvironmentVariables>);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: config.get<string>('NODE_ENV') === 'production',
    }),
  );
  app.enableShutdownHooks();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
  const origins = parseCorsOrigins(config.get<string>('CORS_ORIGIN'));
  app.use(csrfProtection(new Set(origins)));
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'X-Hospital-Id',
      'X-CSRF-Token',
      'X-Admin-CSRF-Token',
    ],
  });
  await app.listen(config.get<number>('PORT', 3001), '0.0.0.0');
}
bootstrap().catch((err) => {
  console.error('Falha ao arrancar a aplicação:', err);
  process.exit(1);
});
