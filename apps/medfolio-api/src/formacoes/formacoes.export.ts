import ExcelJS from 'exceljs';
import type { FormacoesService } from './formacoes.service';

type Rows = Awaited<ReturnType<FormacoesService['list']>>;

export function buildFormacoesWorkbook(rows: Rows): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Formações');
  sheet.columns = [
    { header: 'Título', key: 'titulo', width: 45 },
    { header: 'Tipo', key: 'tipo', width: 20 },
    { header: 'Categoria', key: 'categoria', width: 22 },
    { header: 'Início', key: 'dataInicio', width: 14 },
    { header: 'Fim', key: 'dataFim', width: 14 },
    { header: 'Entidade organizadora', key: 'entidadeOrganizadora', width: 35 },
    { header: 'Localização', key: 'localizacao', width: 25 },
    { header: 'Participação', key: 'tipoParticipacao', width: 20 },
    { header: 'Tema', key: 'temaApresentacao', width: 40 },
    { header: 'Duração (h)', key: 'duracaoHoras', width: 18 },
    { header: 'Créditos', key: 'creditos', width: 14 },
    { header: 'Descrição', key: 'descricao', width: 45 },
    { header: 'Observações', key: 'observacoes', width: 45 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow({ ...row, creditos: row.creditos ? Number(row.creditos) : null });
  }
  sheet.autoFilter = { from: 'A1', to: 'M1' };
  return workbook;
}
