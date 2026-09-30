import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AtividadesCientificasModule } from './atividades-cientificas/atividades-cientificas.module';
import { FormacoesModule } from './formacoes/formacoes.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { RegistosCirurgicosModule } from './registos-cirurgicos/registos-cirurgicos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CirurgiasPorAreaModule } from './cirurgias-por-area/cirurgias-por-area.module';
import { AdminModule } from './admin/admin.module';
import { TiposDeCirurgiaModule } from './tipos-de-cirurgia/tipos-de-cirurgia.module';
import { FuncoesCirurgiaoModule } from './funcoes-cirurgiao/funcoes-cirurgiao.module';
import { TiposDeAbordagemModule } from './tipos-de-abordagem/tipos-de-abordagem.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 200 }]),
    DrizzleModule,
    AuthModule,
    ProfileModule,
    HospitalsModule,
    UtentesModule,
    EspecialidadesModule,
    ZonasAnatomicasModule,
    DiagnosticosModule,
    ProcedimentosModule,
    AtividadesCientificasModule,
    FormacoesModule,
    CatalogosModule,
    RegistosCirurgicosModule,
    DashboardModule,
    CirurgiasPorAreaModule,
    AdminModule,
    TiposDeCirurgiaModule,
    FuncoesCirurgiaoModule,
    TiposDeAbordagemModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
