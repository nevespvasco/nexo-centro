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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  createRegistoSchema,
  type CreateRegisto,
  type RegistoFiltros,
  type UpdateRegisto,
  updateRegistoSchema,
} from '@nexo-centro/schemas';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RegistosCirurgicosService } from './registos-cirurgicos.service';
import { buildRegistosWorkbook } from './registos-cirurgicos.export';

@Controller('registos-cirurgicos')
@UseGuards(JwtAuthGuard, HospitalScopeGuard)
export class RegistosCirurgicosController {
  constructor(private readonly service: RegistosCirurgicosService) {}

  @Get()
  list(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('diagnosticoId') diagnosticoId?: string,
    @Query('procedimentoId') procedimentoId?: string,
    @Query('funcaoCirurgiaoId') funcaoCirurgiaoId?: string,
    @Query('tipoDeCirurgiaIds') tipoDeCirurgiaIds?: string | string[],
  ) {
    const filtros: RegistoFiltros = {
      search: search || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      diagnosticoId: diagnosticoId || undefined,
      procedimentoId: procedimentoId || undefined,
      funcaoCirurgiaoId: funcaoCirurgiaoId || undefined,
      tipoDeCirurgiaIds: tipoDeCirurgiaIds
        ? (Array.isArray(tipoDeCirurgiaIds)
            ? tipoDeCirurgiaIds
            : [tipoDeCirurgiaIds]
          ).filter(Boolean)
        : undefined,
    };
    return this.service.list(hospitalId, userId, limit, offset, filtros);
  }

  @Get('export')
  async export(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('diagnosticoId') diagnosticoId?: string,
    @Query('procedimentoId') procedimentoId?: string,
    @Query('funcaoCirurgiaoId') funcaoCirurgiaoId?: string,
    @Query('tipoDeCirurgiaIds') tipoDeCirurgiaIds?: string | string[],
  ) {
    const filtros: RegistoFiltros = {
      search: search || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      diagnosticoId: diagnosticoId || undefined,
      procedimentoId: procedimentoId || undefined,
      funcaoCirurgiaoId: funcaoCirurgiaoId || undefined,
      tipoDeCirurgiaIds: tipoDeCirurgiaIds
        ? (Array.isArray(tipoDeCirurgiaIds) ? tipoDeCirurgiaIds : [tipoDeCirurgiaIds]).filter(Boolean)
        : undefined,
    };
    const workbook = buildRegistosWorkbook(await this.service.exportRows(hospitalId, userId, filtros));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="registos-cirurgicos.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get(':id')
  findOne(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(hospitalId, userId, id);
  }

  @Post()
  create(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createRegistoSchema)) body: CreateRegisto,
  ) {
    return this.service.create(hospitalId, userId, body);
  }

  @Patch(':id')
  update(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRegistoSchema)) body: UpdateRegisto,
  ) {
    return this.service.update(hospitalId, userId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(hospitalId, userId, id);
  }
}
