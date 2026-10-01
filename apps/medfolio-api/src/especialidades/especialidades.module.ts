import { Module } from '@nestjs/common';
import type { Database } from '@nexo-centro/db';
import { JwtModule } from '../auth/jwt.module';
import { DRIZZLE } from '../database/drizzle.constants';
import { SharedCatalogService } from '../common/catalog-shared.service';
import { especialidadesCatalog } from '../common/catalog-shared.configs';
import {
  EspecialidadesController,
  ESPECIALIDADES_CATALOG,
} from './especialidades.controller';

@Module({
  imports: [JwtModule],
  controllers: [EspecialidadesController],
  providers: [
    {
      provide: ESPECIALIDADES_CATALOG,
      inject: [DRIZZLE],
      useFactory: (db: Database) =>
        new SharedCatalogService(db, especialidadesCatalog),
    },
  ],
})
export class EspecialidadesModule {}
