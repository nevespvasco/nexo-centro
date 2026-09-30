import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../config/env.validation';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants';

@Module({
  imports: [
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
        verifyOptions: { issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
      }),
    }),
  ],
  exports: [NestJwtModule],
})
export class JwtModule {}
