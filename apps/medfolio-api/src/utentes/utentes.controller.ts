import {
  Body,
  Controller,
  Delete,
  DefaultValuePipe,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createUtenteSchema,
  type CreateUtente,
  type UpdateUtente,
  updateUtenteSchema,
} from '@nexo-centro/schemas';
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
  list(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.utentesService.list(hospitalId, userId, limit, offset);
  }

  @Get('processo/:processo')
  async findByProcesso(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('processo') processo: string,
  ) {
    const utente = await this.utentesService.findByProcesso(
      hospitalId,
      userId,
      processo,
    );
    return { utente };
  }

  @Get(':id')
  findOne(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.utentesService.findOne(hospitalId, userId, id);
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
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUtenteSchema)) body: UpdateUtente,
  ) {
    return this.utentesService.update(hospitalId, userId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.utentesService.remove(hospitalId, userId, id);
  }
}
