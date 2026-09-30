import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CirurgiasPorAreaService } from './cirurgias-por-area.service';

@Controller('cirurgias-por-area')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class CirurgiasPorAreaController {
  constructor(private readonly service: CirurgiasPorAreaService) {}

  @Get()
  report(@CurrentHospital() hospitalId: string, @CurrentUser() userId: string) {
    return this.service.report(hospitalId, userId);
  }
}
