import ExcelJS from 'exceljs';
import type { RegistosCirurgicosService } from './registos-cirurgicos.service';

type Rows = Awaited<ReturnType<RegistosCirurgicosService['exportRows']>>;

export function buildRegistosWorkbook(rows: Rows): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Registos cirúrgicos');
  sheet.columns = [
    { header: 'Data', key: 'data', width: 14 },
    { header: 'Idade', key: 'idade', width: 10 },
    { header: 'Sexo', key: 'sexo', width: 12 },
    { header: 'Processo', key: 'processo', width: 20 },
    { header: 'Hospital', key: 'hospital', width: 30 },
    { header: 'Especialidade', key: 'especialidade', width: 28 },
    { header: 'Tipo de cirurgia', key: 'tipoCirurgia', width: 24 },
    { header: 'Tipo de abordagem', key: 'tipoAbordagem', width: 24 },
    { header: 'Ambulatório', key: 'ambulatorio', width: 15 },
    { header: 'Cirurgias', key: 'cirurgias', width: 70 },
    { header: 'Observações', key: 'observacoes', width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow({
      data: row.dataCirurgia,
      idade: row.idadeCirurgia,
      sexo: row.utenteSexo ?? 'N/A',
      processo: row.utenteProcesso,
      hospital: row.hospitalNome,
      especialidade: row.especialidadeNome ?? 'N/A',
      tipoCirurgia: row.tipoDeCirurgiaNome ?? 'N/A',
      tipoAbordagem: row.tipoDeAbordagemNome ?? 'N/A',
      ambulatorio: row.ambulatorio ? 'Sim' : 'Não',
      cirurgias: row.cirurgias.map((cirurgia) => `${cirurgia.diagnosticoNome ?? 'N/A'} — ${cirurgia.procedimentoNome ?? 'N/A'} (${cirurgia.funcaoCirurgiaoNome ?? 'N/A'})`).join('; '),
      observacoes: row.observacoes,
    });
  }
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  return workbook;
}
