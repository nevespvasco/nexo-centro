import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';

@Module({
  imports: [JwtModule],
  controllers: [CatalogosController],
  providers: [CatalogosService],
})
export class CatalogosModule {}
