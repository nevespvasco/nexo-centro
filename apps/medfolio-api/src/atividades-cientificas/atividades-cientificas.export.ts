import ExcelJS from 'exceljs';
import type { AtividadesCientificasService } from './atividades-cientificas.service';

type Rows = Awaited<ReturnType<AtividadesCientificasService['list']>>;

export function buildAtividadesWorkbook(rows: Rows): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Atividades científicas');
  sheet.columns = [
    { header: 'Data', key: 'data', width: 14 },
    { header: 'Título', key: 'titulo', width: 45 },
    { header: 'Tipo', key: 'tipo', width: 18 },
    { header: 'Categoria', key: 'categoria', width: 22 },
    { header: 'Autores', key: 'autores', width: 45 },
    { header: 'Autor principal', key: 'autorPrincipal', width: 18 },
    { header: 'Posição', key: 'posicaoAutor', width: 12 },
    { header: 'Revista/Conferência', key: 'revistaConferencia', width: 35 },
    { header: 'Localização', key: 'localizacao', width: 25 },
    { header: 'DOI', key: 'doi', width: 30 },
    { header: 'ISBN', key: 'isbn', width: 20 },
    { header: 'Link', key: 'link', width: 45 },
    { header: 'Fator de impacto', key: 'fatorImpacto', width: 20 },
    { header: 'Descrição', key: 'descricao', width: 45 },
    { header: 'Observações', key: 'observacoes', width: 45 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow({
      ...row,
      autorPrincipal: row.autorPrincipal ? 'Sim' : 'Não',
      fatorImpacto: row.fatorImpacto ? Number(row.fatorImpacto) : null,
    });
  }
  sheet.autoFilter = { from: 'A1', to: 'O1' };
  return workbook;
}
