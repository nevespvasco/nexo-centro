import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { UtentesController } from './utentes.controller';
import { UtentesService } from './utentes.service';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';

@Module({
  imports: [JwtModule],
  controllers: [UtentesController],
  providers: [UtentesService, HospitalReadScopeGuard],
})
export class UtentesModule {}
