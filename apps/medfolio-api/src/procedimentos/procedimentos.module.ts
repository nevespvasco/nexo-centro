import { Module } from '@nestjs/common';
import type { Database } from '@nexo-centro/db';
import { JwtModule } from '../auth/jwt.module';
import { DRIZZLE } from '../database/drizzle.constants';
import { SharedCatalogService } from '../common/catalog-shared.service';
import { procedimentosCatalog } from '../common/catalog-shared.configs';
import {
  ProcedimentosController,
  PROCEDIMENTOS_CATALOG,
} from './procedimentos.controller';

@Module({
  imports: [JwtModule],
  controllers: [ProcedimentosController],
  providers: [
    {
      provide: PROCEDIMENTOS_CATALOG,
      inject: [DRIZZLE],
      useFactory: (db: Database) =>
        new SharedCatalogService(db, procedimentosCatalog),
    },
  ],
})
export class ProcedimentosModule {}
