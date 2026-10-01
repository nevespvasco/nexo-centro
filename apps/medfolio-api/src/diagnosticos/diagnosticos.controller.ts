import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createDiagnosticoSchema,
  type CreateDiagnostico,
  type UpdateDiagnostico,
  updateDiagnosticoSchema,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';
import { CurrentHospitals } from '../common/current-hospitals.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DiagnosticosService } from './diagnosticos.service';

@Controller('diagnosticos')
@UseGuards(JwtAuthGuard)
export class DiagnosticosController {
  constructor(private readonly diagnosticosService: DiagnosticosService) {}

  // Página de gestão: diagnósticos no âmbito selecionado (com nome do hospital).
  @Get('multi')
  @UseGuards(HospitalReadScopeGuard)
  listMulti(@CurrentHospitals() hospitalIds: string[]) {
    return this.diagnosticosService.listMulti(hospitalIds);
  }

  @Get()
  @UseGuards(HospitalScopeGuard)
  list(@CurrentHospital() hospitalId: string) {
    return this.diagnosticosService.list(hospitalId);
  }

  @Get(':id')
  @UseGuards(HospitalScopeGuard)
  findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.diagnosticosService.findOne(hospitalId, id);
  }

  @Post()
  @UseGuards(HospitalScopeGuard)
  create(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(createDiagnosticoSchema))
    body: CreateDiagnostico,
  ) {
    return this.diagnosticosService.create(hospitalId, body);
  }

  @Patch(':id')
  @UseGuards(HospitalScopeGuard)
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDiagnosticoSchema))
    body: UpdateDiagnostico,
  ) {
    return this.diagnosticosService.update(hospitalId, id, body);
  }

  @Delete(':id')
  @UseGuards(HospitalScopeGuard)
  remove(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.diagnosticosService.remove(hospitalId, id);
  }
}
