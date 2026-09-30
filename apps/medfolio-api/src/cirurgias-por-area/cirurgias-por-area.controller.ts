import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { CurrentHospitals } from '../common/current-hospitals.decorator';
import { HospitalReadScopeGuard } from '../common/hospital-read-scope.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CirurgiasPorAreaService } from './cirurgias-por-area.service';

@Controller('cirurgias-por-area')
@UseGuards(JwtAuthGuard, HospitalReadScopeGuard)
export class CirurgiasPorAreaController {
  constructor(private readonly service: CirurgiasPorAreaService) {}

  @Get()
  report(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
  ) {
    return this.service.reportMulti(hospitalIds, userId);
  }

  @Get('export')
  async export(
    @CurrentHospitals() hospitalIds: string[],
    @CurrentUser() userId: string,
    @Res() res: Response,
    @Query('scope') scope?: 'all' | 'selected',
  ) {
    const data = await this.service.reportMulti(hospitalIds, userId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cirurgias-por-area.xlsx"',
    );
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
    });
    const sheet = workbook.addWorksheet('Cirurgias por área');
    sheet.columns = [
      { header: 'Hospital ID', key: 'hospitalId', width: 38 },
      { header: 'Hospital', key: 'hospital', width: 30 },
      { header: 'Zona anatómica', key: 'zona', width: 30 },
      { header: 'Classificação', key: 'tipo', width: 18 },
      { header: 'Diagnóstico', key: 'diagnostico', width: 40 },
      { header: 'Procedimento', key: 'procedimento', width: 40 },
      { header: 'Cirurgias', key: 'total', width: 15 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).commit();
    let total = 0;
    for (const report of data.reports) {
      for (const zona of report.zonas) {
        for (const grupo of zona.grupos) {
          for (const linha of grupo.linhas) {
            sheet
              .addRow({
                hospitalId: report.hospitalId,
                hospital: report.hospitalNome,
                zona: zona.zonaAnatomicaNome,
                tipo:
                  grupo.tipo === 'benigno'
                    ? 'Benigno'
                    : grupo.tipo === 'maligno'
                      ? 'Maligno'
                      : 'Sem classificação',
                diagnostico: linha.diagnosticoNome,
                procedimento: linha.procedimentoNome,
                total: linha.total,
              })
              .commit();
            total += linha.total;
          }
        }
      }
    }
    sheet.commit();
    const meta = workbook.addWorksheet('Âmbito e filtros');
    for (const pair of [
      ['Tema', 'Cirurgias por área'],
      [
        'Âmbito',
        scope === 'all'
          ? `Todos os hospitais (${hospitalIds.length})`
          : `${hospitalIds.length} hospitais selecionados`,
      ],
      [
        'Hospitais',
        data.reports.map((report) => report.hospitalNome).join(', '),
      ],
      ['IDs dos hospitais', hospitalIds.join(', ')],
      ['Data de geração', new Date().toISOString()],
      ['Cirurgias exportadas', total],
    ] as [string, string | number][])
      meta.addRow(pair).commit();
    meta.commit();
    await workbook.commit();
  }
}
