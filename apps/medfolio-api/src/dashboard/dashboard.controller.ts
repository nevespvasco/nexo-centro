import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentHospitals } from '../common/current-hospitals.decorator';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, HospitalReadScopeGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  summary(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
  ) {
    return this.service.summary(hospitalIds, userId);
  }
}
