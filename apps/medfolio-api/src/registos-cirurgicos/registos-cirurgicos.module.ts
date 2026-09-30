import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { RegistosCirurgicosController } from './registos-cirurgicos.controller';
import { RegistosCirurgicosService } from './registos-cirurgicos.service';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';

@Module({
  imports: [JwtModule],
  controllers: [RegistosCirurgicosController],
  providers: [RegistosCirurgicosService, HospitalReadScopeGuard],
})
export class RegistosCirurgicosModule {}
