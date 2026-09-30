import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import type { CirurgiasPorAreaService } from './cirurgias-por-area.service';
import { CirurgiasPorAreaController } from './cirurgias-por-area.controller';

describe('Cirurgias por Área export', () => {
  it('includes the origin hospital and final intervention count', async () => {
    const reportMulti = jest.fn().mockResolvedValue({
      total: 3,
      reports: [
        {
          hospitalId: 'hospital-1',
          hospitalNome: 'Hospital A',
          total: 3,
          zonas: [
            {
              zonaAnatomicaNome: 'Abdómen',
              grupos: [
                {
                  tipo: 'benigno',
                  linhas: [
                    {
                      diagnosticoNome: 'Diagnóstico',
                      procedimentoNome: 'Procedimento',
                      total: 3,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const service = { reportMulti } as unknown as CirurgiasPorAreaService;
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    const response = Object.assign(stream, {
      setHeader: jest.fn(),
    }) as unknown as Response;

    await new CirurgiasPorAreaController(service).export(
      ['hospital-1'],
      'user-1',
      response,
      'selected',
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks));
    const sheet = workbook.getWorksheet('Cirurgias por área')!;
    expect(sheet.getRow(2).getCell(1).value).toBe('hospital-1');
    expect(sheet.getRow(2).getCell(2).value).toBe('Hospital A');
    expect(sheet.getRow(2).getCell(7).value).toBe(3);
    expect(
      workbook.getWorksheet('Âmbito e filtros')!.getRow(6).getCell(2).value,
    ).toBe(3);
    expect(reportMulti).toHaveBeenCalledWith(['hospital-1'], 'user-1');
  });
});
