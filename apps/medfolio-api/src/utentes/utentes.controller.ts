import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { createUtenteSchema, type CreateUtente, type UpdateUtente, updateUtenteSchema } from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UtentesService } from './utentes.service';

@Controller('utentes')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class UtentesController {
  constructor(private readonly utentesService: UtentesService) {}

  @Get()
  list(@CurrentHospital() hospitalId: string) {
    return this.utentesService.list(hospitalId);
  }

  @Get(':id')
  findOne(@CurrentHospital() hospitalId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.utentesService.findOne(hospitalId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createUtenteSchema)) body: CreateUtente,
  ) {
    return this.utentesService.create(hospitalId, userId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUtenteSchema)) body: UpdateUtente,
  ) {
    return this.utentesService.update(hospitalId, id, body);
  }

  @Delete(':id')
  remove(@CurrentHospital() hospitalId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.utentesService.remove(hospitalId, id);
  }
}
