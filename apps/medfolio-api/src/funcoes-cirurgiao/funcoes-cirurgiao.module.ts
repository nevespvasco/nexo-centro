import { Module } from '@nestjs/common';
import type { Database } from '@nexo-centro/db';
import { JwtModule } from '../auth/jwt.module';
import { DRIZZLE } from '../database/drizzle.constants';
import { SharedCatalogService } from '../common/catalog-shared.service';
import { funcoesCirurgiaoCatalog } from '../common/catalog-shared.configs';
import {
  FuncoesCirurgiaoController,
  FUNCOES_CIRURGIAO_CATALOG,
} from './funcoes-cirurgiao.controller';

@Module({
  imports: [JwtModule],
  controllers: [FuncoesCirurgiaoController],
  providers: [
    {
      provide: FUNCOES_CIRURGIAO_CATALOG,
      inject: [DRIZZLE],
      useFactory: (db: Database) =>
        new SharedCatalogService(db, funcoesCirurgiaoCatalog),
    },
  ],
})
export class FuncoesCirurgiaoModule {}
