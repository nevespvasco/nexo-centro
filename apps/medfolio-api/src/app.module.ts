import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { validate } from './config/env.validation';
import { DrizzleModule } from './database/drizzle.module';
import { DiagnosticosModule } from './diagnosticos/diagnosticos.module';
import { EspecialidadesModule } from './especialidades/especialidades.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { ProcedimentosModule } from './procedimentos/procedimentos.module';
import { ProfileModule } from './profile/profile.module';
import { UtentesModule } from './utentes/utentes.module';
import { ZonasAnatomicasModule } from './zonas-anatomicas/zonas-anatomicas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    DrizzleModule,
    AuthModule,
    ProfileModule,
    HospitalsModule,
    UtentesModule,
    EspecialidadesModule,
    ZonasAnatomicasModule,
    DiagnosticosModule,
    ProcedimentosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
