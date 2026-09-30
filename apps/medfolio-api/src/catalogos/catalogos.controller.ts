import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CatalogosService } from './catalogos.service';

@Controller('catalogos')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class CatalogosController {
  constructor(private readonly service: CatalogosService) {}

  @Get('registo')
  registo(@CurrentHospital() hospitalId: string) {
    return this.service.registo(hospitalId);
  }
}
