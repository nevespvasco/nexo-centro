import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import type { RegistosCirurgicosService } from './registos-cirurgicos.service';
import { RegistosCirurgicosController } from './registos-cirurgicos.controller';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('multi-hospital export', () => {
  it('streams one workbook with a hospital on every row and the final count', async () => {
    const exportSurgeryLabels = jest
      .fn()
      .mockResolvedValue(
        new Map([[A, ['Diagnóstico — Procedimento (Cirurgião)']]]),
      );
    const service = {
      statistics: jest.fn().mockResolvedValue({
        perHospital: [
          { hospitalId: A, hospitalNome: 'Hospital A' },
          { hospitalId: B, hospitalNome: 'Hospital B' },
        ],
      }),
      listMulti: jest.fn().mockResolvedValue({
        rows: [
          {
            id: A,
            hospitalId: A,
            hospitalNome: 'Hospital A',
            dataCirurgia: '2026-01-10',
            utenteProcesso: '1',
            ambulatorio: false,
          },
          {
            id: B,
            hospitalId: B,
            hospitalNome: 'Hospital B',
            dataCirurgia: '2026-01-11',
            utenteProcesso: '2',
            ambulatorio: true,
          },
        ],
      }),
      exportSurgeryLabels,
    } as unknown as RegistosCirurgicosService;
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    const response = Object.assign(stream, {
      setHeader: jest.fn(),
    }) as unknown as Response;
    const controller = new RegistosCirurgicosController(service);

    await controller.export(
      [A, B],
      'user-id',
      response,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'all',
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks));
    const rows = workbook.getWorksheet('Registos cirúrgicos')!;
    expect(rows.getRow(2).getCell(6).value).toBe(A);
    expect(rows.getRow(2).getCell(7).value).toBe('Hospital A');
    expect(rows.getRow(3).getCell(6).value).toBe(B);
    expect(rows.getRow(3).getCell(7).value).toBe('Hospital B');
    expect(rows.getRow(4).getCell(1).value).toBeNull();
    const meta = workbook.getWorksheet('Âmbito e filtros')!;
    expect(meta.getRow(6).getCell(2).value).toBe(2);
    expect(exportSurgeryLabels).toHaveBeenCalledWith([A, B], 'user-id', [A, B]);
  });
});
