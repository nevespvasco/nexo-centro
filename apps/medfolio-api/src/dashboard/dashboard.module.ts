import { Module } from '@nestjs/common';
import { JwtModule } from '../auth/jwt.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';

@Module({
  imports: [JwtModule],
  controllers: [DashboardController],
  providers: [DashboardService, HospitalReadScopeGuard],
})
export class DashboardModule {}
