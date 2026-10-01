import { Module } from '@nestjs/common';
import type { Database } from '@nexo-centro/db';
import { JwtModule } from '../auth/jwt.module';
import { DRIZZLE } from '../database/drizzle.constants';
import { SharedCatalogService } from '../common/catalog-shared.service';
import { tiposDeCirurgiaCatalog } from '../common/catalog-shared.configs';
import {
  TiposDeCirurgiaController,
  TIPOS_DE_CIRURGIA_CATALOG,
} from './tipos-de-cirurgia.controller';

@Module({
  imports: [JwtModule],
  controllers: [TiposDeCirurgiaController],
  providers: [
    {
      provide: TIPOS_DE_CIRURGIA_CATALOG,
      inject: [DRIZZLE],
      useFactory: (db: Database) =>
        new SharedCatalogService(db, tiposDeCirurgiaCatalog),
    },
  ],
})
export class TiposDeCirurgiaModule {}
