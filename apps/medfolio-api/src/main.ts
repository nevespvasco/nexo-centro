import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseCorsOrigins(value?: string): string[] {
  return value?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = parseCorsOrigins(process.env.CORS_ORIGIN);
  app.enableCors({ origin: origins.length ? origins : false, credentials: true });
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
