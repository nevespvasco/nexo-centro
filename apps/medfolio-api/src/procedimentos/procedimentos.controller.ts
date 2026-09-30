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
  createProcedimentoSchema,
  type CreateProcedimento,
  type UpdateProcedimento,
  updateProcedimentoSchema,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProcedimentosService } from './procedimentos.service';

@Controller('procedimentos')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class ProcedimentosController {
  constructor(private readonly procedimentosService: ProcedimentosService) {}

  @Get()
  list(@CurrentHospital() hospitalId: string) {
    return this.procedimentosService.list(hospitalId);
  }

  @Get(':id')
  findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.procedimentosService.findOne(hospitalId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @Body(new ZodValidationPipe(createProcedimentoSchema))
    body: CreateProcedimento,
  ) {
    return this.procedimentosService.create(hospitalId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProcedimentoSchema))
    body: UpdateProcedimento,
  ) {
    return this.procedimentosService.update(hospitalId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.procedimentosService.remove(hospitalId, id);
  }
}
