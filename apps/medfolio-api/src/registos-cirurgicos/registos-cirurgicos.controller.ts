import {
  Body,
  BadRequestException,
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
  registoFiltrosSchema,
} from '@nexo-centro/schemas';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';
import { CurrentHospitals } from '../common/current-hospitals.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RegistosCirurgicosService } from './registos-cirurgicos.service';

@Controller('registos-cirurgicos')
@UseGuards(JwtAuthGuard)
export class RegistosCirurgicosController {
  constructor(private readonly service: RegistosCirurgicosService) {}

  @Get()
  @UseGuards(HospitalReadScopeGuard)
  list(
    @CurrentHospitals() hospitalIds: string[],
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
    const filtros = this.parseFilters({
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
    });
    return this.service.listMulti(hospitalIds, userId, limit, offset, filtros);
  }

  @Get('statistics')
  @UseGuards(HospitalReadScopeGuard)
  statistics(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
    @Query('search') search?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('diagnosticoId') diagnosticoId?: string,
    @Query('procedimentoId') procedimentoId?: string,
    @Query('funcaoCirurgiaoId') funcaoCirurgiaoId?: string,
    @Query('tipoDeCirurgiaIds') tipoDeCirurgiaIds?: string | string[],
  ) {
    return this.service.statistics(
      hospitalIds,
      userId,
      this.parseFilters({
        search,
        dataInicio,
        dataFim,
        diagnosticoId,
        procedimentoId,
        funcaoCirurgiaoId,
        tipoDeCirurgiaIds: tipoDeCirurgiaIds
          ? Array.isArray(tipoDeCirurgiaIds)
            ? tipoDeCirurgiaIds
            : [tipoDeCirurgiaIds]
          : undefined,
      }),
    );
  }

  @Get('export')
  @UseGuards(HospitalReadScopeGuard)
  async export(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('diagnosticoId') diagnosticoId?: string,
    @Query('procedimentoId') procedimentoId?: string,
    @Query('funcaoCirurgiaoId') funcaoCirurgiaoId?: string,
    @Query('tipoDeCirurgiaIds') tipoDeCirurgiaIds?: string | string[],
    @Query('scope') scope?: 'all' | 'selected',
  ) {
    const filtros = this.parseFilters({
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
    });
    const hospitalNames = (
      await this.service.statistics(hospitalIds, userId, filtros)
    ).perHospital.map((h) => h.hospitalNome);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="registos-cirurgicos.xlsx"',
    );
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
    });
    const sheet = workbook.addWorksheet('Registos cirúrgicos');
    sheet.columns = [
      { header: 'ID do registo', key: 'id', width: 38 },
      { header: 'Data', key: 'data', width: 14 },
      { header: 'Idade', key: 'idade', width: 10 },
      { header: 'Sexo', key: 'sexo', width: 12 },
      { header: 'Processo', key: 'processo', width: 20 },
      { header: 'Hospital ID', key: 'hospitalId', width: 38 },
      { header: 'Hospital', key: 'hospital', width: 30 },
      { header: 'Especialidade', key: 'especialidade', width: 28 },
      { header: 'Tipo de cirurgia', key: 'tipoCirurgia', width: 24 },
      { header: 'Tipo de abordagem', key: 'tipoAbordagem', width: 24 },
      { header: 'Ambulatório', key: 'ambulatorio', width: 15 },
      { header: 'Cirurgias', key: 'cirurgias', width: 70 },
      { header: 'Observações', key: 'observacoes', width: 50 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).commit();
    let exported = 0;
    let cursor: { data: string; id: string } | undefined;
    for (;;) {
      const page = await this.service.listMulti(
        hospitalIds,
        userId,
        100,
        0,
        filtros,
        { cursor, includeTotal: false },
      );
      if (!page.rows.length) break;
      const labels = await this.service.exportSurgeryLabels(
        hospitalIds,
        userId,
        page.rows.map((row) => row.id),
      );
      for (const row of page.rows) {
        sheet
          .addRow({
            id: row.id,
            data: row.dataCirurgia,
            idade: row.idadeCirurgia,
            sexo: row.utenteSexo ?? 'N/A',
            processo: row.utenteProcesso,
            hospitalId: row.hospitalId,
            hospital: row.hospitalNome,
            especialidade: row.especialidadeNome ?? 'N/A',
            tipoCirurgia: row.tipoDeCirurgiaNome ?? 'N/A',
            tipoAbordagem: row.tipoDeAbordagemNome ?? 'N/A',
            ambulatorio: row.ambulatorio ? 'Sim' : 'Não',
            cirurgias: (labels.get(row.id) ?? []).join('; '),
            observacoes: row.observacoes,
          })
          .commit();
        exported++;
      }
      const last = page.rows[page.rows.length - 1];
      cursor = { data: last.dataCirurgia, id: last.id };
      if (page.rows.length < 100) break;
    }
    sheet.commit();
    const meta = workbook.addWorksheet('Âmbito e filtros');
    for (const pair of [
      ['Tema', 'Registos cirúrgicos'],
      [
        'Âmbito',
        scope === 'all'
          ? `Todos os hospitais (${hospitalIds.length})`
          : `${hospitalIds.length} hospitais selecionados`,
      ],
      ['Hospitais', hospitalNames.join(', ')],
      ['IDs dos hospitais', hospitalIds.join(', ')],
      ['Data de geração', new Date().toISOString()],
      ['Registos exportados', exported],
      ['Pesquisa', filtros.search ?? ''],
      ['Data início', filtros.dataInicio ?? ''],
      ['Data fim', filtros.dataFim ?? ''],
      ['Diagnóstico ID', filtros.diagnosticoId ?? ''],
      ['Procedimento ID', filtros.procedimentoId ?? ''],
      ['Função ID', filtros.funcaoCirurgiaoId ?? ''],
      ['Tipos IDs', filtros.tipoDeCirurgiaIds?.join(', ') ?? ''],
    ] as [string, string | number][])
      meta.addRow(pair).commit();
    meta.commit();
    await workbook.commit();
  }

  private parseFilters(input: RegistoFiltros): RegistoFiltros {
    const result = registoFiltrosSchema.safeParse(input);
    if (!result.success) throw new BadRequestException('Filtros inválidos.');
    return result.data;
  }

  @Get(':id')
  @UseGuards(HospitalScopeGuard)
  findOne(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(hospitalId, userId, id);
  }

  @Post()
  @UseGuards(HospitalScopeGuard)
  create(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createRegistoSchema)) body: CreateRegisto,
  ) {
    return this.service.create(hospitalId, userId, body);
  }

  @Patch(':id')
  @UseGuards(HospitalScopeGuard)
  update(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRegistoSchema)) body: UpdateRegisto,
  ) {
    return this.service.update(hospitalId, userId, id, body);
  }

  @Delete(':id')
  @UseGuards(HospitalScopeGuard)
  remove(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(hospitalId, userId, id);
  }
}
