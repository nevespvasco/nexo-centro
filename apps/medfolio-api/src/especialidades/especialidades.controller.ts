import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createEspecialidadeSchema,
  type CreateEspecialidade,
  type UpdateEspecialidade,
  updateEspecialidadeSchema,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EspecialidadesService } from './especialidades.service';

@Controller('especialidades')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class EspecialidadesController {
  constructor(private readonly especialidadesService: EspecialidadesService) {}

  @Get()
  list(@CurrentHospital() hospitalId: string) {
    return this.especialidadesService.list(hospitalId);
  }

  @Get(':id')
  findOne(@CurrentHospital() hospitalId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.especialidadesService.findOne(hospitalId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(createEspecialidadeSchema)) body: CreateEspecialidade,
  ) {
    return this.especialidadesService.create(hospitalId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateEspecialidadeSchema)) body: UpdateEspecialidade,
  ) {
    return this.especialidadesService.update(hospitalId, id, body);
  }

  @Delete(':id')
  remove(@CurrentHospital() hospitalId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.especialidadesService.remove(hospitalId, id);
  }
}
