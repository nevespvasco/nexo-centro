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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DiagnosticosService } from './diagnosticos.service';

@Controller('diagnosticos')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class DiagnosticosController {
  constructor(private readonly diagnosticosService: DiagnosticosService) {}

  @Get()
  list(@CurrentHospital() hospitalId: string) {
    return this.diagnosticosService.list(hospitalId);
  }

  @Get(':id')
  findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.diagnosticosService.findOne(hospitalId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(createDiagnosticoSchema))
    body: CreateDiagnostico,
  ) {
    return this.diagnosticosService.create(hospitalId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDiagnosticoSchema))
    body: UpdateDiagnostico,
  ) {
    return this.diagnosticosService.update(hospitalId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.diagnosticosService.remove(hospitalId, id);
  }
}
