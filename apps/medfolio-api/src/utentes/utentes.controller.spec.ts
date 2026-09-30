import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import type { UtentesService } from './utentes.service';
import { UtentesController } from './utentes.controller';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('UtentesController multi export', () => {
  it('keeps the hospital on each patient row and records the final count', async () => {
    const exportPage = jest.fn().mockResolvedValue([
      {
        id: A,
        nome: 'Utente A',
        processo: '001',
        hospitalId: A,
        hospitalNome: 'Hospital A',
      },
      {
        id: B,
        nome: 'Utente B',
        processo: '002',
        hospitalId: B,
        hospitalNome: 'Hospital B',
      },
    ]);
    const service = {
      hospitalNames: jest.fn().mockResolvedValue([
        { id: A, nome: 'Hospital A' },
        { id: B, nome: 'Hospital B' },
      ]),
      exportPage,
    } as unknown as UtentesService;
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    const response = Object.assign(stream, {
      setHeader: jest.fn(),
    }) as unknown as Response;

    await new UtentesController(service).exportMulti(
      [A, B],
      'user-id',
      response,
      'Utente',
      'all',
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks));
    const sheet = workbook.getWorksheet('Utentes')!;
    expect(sheet.getRow(2).getCell(6).value).toBe(A);
    expect(sheet.getRow(3).getCell(7).value).toBe('Hospital B');
    expect(
      workbook.getWorksheet('Âmbito e filtros')!.getRow(7).getCell(2).value,
    ).toBe(2);
    expect(exportPage).toHaveBeenCalledWith(
      [A, B],
      'user-id',
      'Utente',
      undefined,
    );
  });
});
