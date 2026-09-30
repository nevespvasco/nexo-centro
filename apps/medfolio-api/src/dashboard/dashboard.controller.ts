import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  summary(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
  ) {
    return this.service.summary(hospitalId, userId);
  }
}
