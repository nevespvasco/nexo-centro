import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { CirurgiasPorAreaController } from './cirurgias-por-area.controller';
import { CirurgiasPorAreaService } from './cirurgias-por-area.service';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';

@Module({
  imports: [JwtModule],
  controllers: [CirurgiasPorAreaController],
  providers: [CirurgiasPorAreaService, HospitalReadScopeGuard],
})
export class CirurgiasPorAreaModule {}
