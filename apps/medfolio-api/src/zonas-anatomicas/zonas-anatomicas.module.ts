import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { ZonasAnatomicasController } from './zonas-anatomicas.controller';
import { ZonasAnatomicasService } from './zonas-anatomicas.service';

@Module({
  imports: [JwtModule],
  controllers: [ZonasAnatomicasController],
  providers: [ZonasAnatomicasService],
})
export class ZonasAnatomicasModule {}
