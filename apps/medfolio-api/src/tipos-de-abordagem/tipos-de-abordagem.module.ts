import { Module } from '@nestjs/common';
import type { Database } from '@nexo-centro/db';
import { JwtModule } from '../auth/jwt.module';
import { DRIZZLE } from '../database/drizzle.constants';
import { SharedCatalogService } from '../common/catalog-shared.service';
import { tiposDeAbordagemCatalog } from '../common/catalog-shared.configs';
import {
  TiposDeAbordagemController,
  TIPOS_DE_ABORDAGEM_CATALOG,
} from './tipos-de-abordagem.controller';

@Module({
  imports: [JwtModule],
  controllers: [TiposDeAbordagemController],
  providers: [
    {
      provide: TIPOS_DE_ABORDAGEM_CATALOG,
      inject: [DRIZZLE],
      useFactory: (db: Database) =>
        new SharedCatalogService(db, tiposDeAbordagemCatalog),
    },
  ],
})
export class TiposDeAbordagemModule {}
