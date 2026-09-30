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
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import {
  createUtenteSchema,
  type CreateUtente,
  type UpdateUtente,
  updateUtenteSchema,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentHospital } from '../common/current-hospital.decorator';
import { HospitalScopeGuard } from '../common/hospital-scope.guard';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';
import { CurrentHospitals } from '../common/current-hospitals.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UtentesService } from './utentes.service';

@Controller('utentes')
@UseGuards(JwtAuthGuard)
export class UtentesController {
  constructor(private readonly utentesService: UtentesService) {}

  @Get()
  @UseGuards(HospitalScopeGuard)
  list(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.utentesService.list(hospitalId, userId, limit, offset);
  }

  @Get('multi')
  @UseGuards(HospitalReadScopeGuard)
  listMulti(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search?: string,
  ) {
    return this.utentesService.listMulti(
      hospitalIds,
      userId,
      limit,
      offset,
      search,
    );
  }

  @Get('multi/export')
  @UseGuards(HospitalReadScopeGuard)
  async exportMulti(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('scope') scope?: 'all' | 'selected',
  ) {
    const names = await this.utentesService.hospitalNames(hospitalIds);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="utentes.xlsx"');
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
    });
    const sheet = workbook.addWorksheet('Utentes');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'Processo', key: 'processo', width: 20 },
      { header: 'Sexo', key: 'sexo', width: 14 },
      { header: 'Data de nascimento', key: 'dataNascimento', width: 20 },
      { header: 'Hospital ID', key: 'hospitalId', width: 38 },
      { header: 'Hospital', key: 'hospital', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).commit();
    let exported = 0;
    let cursor: string | undefined;
    for (;;) {
      const page = await this.utentesService.exportPage(
        hospitalIds,
        userId,
        search,
        cursor,
      );
      if (!page.length) break;
      for (const row of page) {
        sheet.addRow({ ...row, hospital: row.hospitalNome }).commit();
        exported++;
      }
      cursor = page[page.length - 1].id;
      if (page.length < 100) break;
    }
    sheet.commit();
    const meta = workbook.addWorksheet('Âmbito e filtros');
    for (const pair of [
      ['Tema', 'Utentes'],
      [
        'Âmbito',
        scope === 'all'
          ? `Todos os hospitais (${hospitalIds.length})`
          : `${hospitalIds.length} hospitais selecionados`,
      ],
      ['Hospitais', names.map((h) => h.nome).join(', ')],
      ['IDs dos hospitais', hospitalIds.join(', ')],
      ['Pesquisa', search ?? ''],
      ['Data de geração', new Date().toISOString()],
      ['Utentes exportados', exported],
    ] as [string, string | number][])
      meta.addRow(pair).commit();
    meta.commit();
    await workbook.commit();
  }

  @Get('processo/:processo')
  @UseGuards(HospitalScopeGuard)
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
  @UseGuards(HospitalScopeGuard)
  findOne(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.utentesService.findOne(hospitalId, userId, id);
  }

  @Post()
  @UseGuards(HospitalScopeGuard)
  create(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createUtenteSchema)) body: CreateUtente,
  ) {
    return this.utentesService.create(hospitalId, userId, body);
  }

  @Patch(':id')
  @UseGuards(HospitalScopeGuard)
  update(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUtenteSchema)) body: UpdateUtente,
  ) {
    return this.utentesService.update(hospitalId, userId, id, body);
  }

  @Delete(':id')
  @UseGuards(HospitalScopeGuard)
  remove(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.utentesService.remove(hospitalId, userId, id);
  }
}
