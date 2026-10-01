import { Module } from '@nestjs/common';
import type { Database } from '@nexo-centro/db';
import { JwtModule } from '../auth/jwt.module';
import { DRIZZLE } from '../database/drizzle.constants';
import { SharedCatalogService } from '../common/catalog-shared.service';
import { zonasAnatomicasCatalog } from '../common/catalog-shared.configs';
import {
  ZonasAnatomicasController,
  ZONAS_ANATOMICAS_CATALOG,
} from './zonas-anatomicas.controller';

@Module({
  imports: [JwtModule],
  controllers: [ZonasAnatomicasController],
  providers: [
    {
      provide: ZONAS_ANATOMICAS_CATALOG,
      inject: [DRIZZLE],
      useFactory: (db: Database) =>
        new SharedCatalogService(db, zonasAnatomicasCatalog),
    },
  ],
})
export class ZonasAnatomicasModule {}
