import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { EspecialidadesController } from './especialidades.controller';
import { EspecialidadesService } from './especialidades.service';

@Module({
  imports: [JwtModule],
  controllers: [EspecialidadesController],
  providers: [EspecialidadesService],
})
export class EspecialidadesModule {}
