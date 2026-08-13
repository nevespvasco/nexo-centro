import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { DrizzleModule } from './database/drizzle.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate }), DrizzleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
