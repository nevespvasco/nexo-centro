import {
  cirurgias,
  diagnosticos,
  especialidadeHospital,
  especialidades,
  funcaoCirurgiaoHospital,
  funcaoCirurgiaos,
  procedimentoHospital,
  procedimentos,
  registoCirurgicos,
  tipoDeAbordagemHospital,
  tipoDeAbordagens,
  tipoDeCirurgiaHospital,
  tipoDeCirurgias,
  users,
  zonaAnatomicaHospital,
  zonaAnatomicas,
} from '@nexo-centro/db';
import type { SharedCatalogConfig } from './catalog-shared.service';

const nomeOnly = (p: Record<string, unknown>) => ({ nome: p.nome });

export const especialidadesCatalog: SharedCatalogConfig = {
  entityType: 'especialidade',
  labels: {
    notFound: 'Especialidade não encontrada.',
    duplicate: 'Já existe uma especialidade com esse nome.',
  },
  globalNameConstraint: 'especialidades_nome_global_uq',
  item: {
    table: especialidades,
    id: especialidades.id,
    nome: especialidades.nome,
    isGlobal: especialidades.isGlobal,
    deletedAt: especialidades.deletedAt,
  },
  assoc: {
    table: especialidadeHospital,
    id: especialidadeHospital.id,
    itemFk: especialidadeHospital.especialidadeId,
    itemFkKey: 'especialidadeId',
    hospitalId: especialidadeHospital.hospitalId,
    deletedAt: especialidadeHospital.deletedAt,
  },
  pickContent: (p) => ({ nome: p.nome, descricao: p.descricao }),
  usages: [
    {
      table: procedimentos,
      itemFk: procedimentos.especialidadeId,
      deletedAt: procedimentos.deletedAt,
      message: 'Não é possível eliminar: está a ser usado por procedimentos.',
    },
    {
      table: users,
      itemFk: users.especialidadeId,
      deletedAt: users.deletedAt,
      message: 'Não é possível eliminar: está a ser usado por utilizadores.',
    },
    {
      table: registoCirurgicos,
      itemFk: registoCirurgicos.especialidadeId,
      deletedAt: registoCirurgicos.deletedAt,
      hospitalColumn: registoCirurgicos.hospitalId,
      message: 'Não é possível: está a ser usado em registos cirúrgicos.',
    },
  ],
};

export const zonasAnatomicasCatalog: SharedCatalogConfig = {
  entityType: 'zona_anatomica',
  labels: {
    notFound: 'Zona anatómica não encontrada.',
    duplicate: 'Já existe uma zona anatómica com esse nome.',
  },
  globalNameConstraint: 'zona_anatomicas_nome_global_uq',
  ordenable: true,
  item: {
    table: zonaAnatomicas,
    id: zonaAnatomicas.id,
    nome: zonaAnatomicas.nome,
    isGlobal: zonaAnatomicas.isGlobal,
    deletedAt: zonaAnatomicas.deletedAt,
  },
  assoc: {
    table: zonaAnatomicaHospital,
    id: zonaAnatomicaHospital.id,
    itemFk: zonaAnatomicaHospital.zonaAnatomicaId,
    itemFkKey: 'zonaAnatomicaId',
    hospitalId: zonaAnatomicaHospital.hospitalId,
    deletedAt: zonaAnatomicaHospital.deletedAt,
    ordem: zonaAnatomicaHospital.ordem,
  },
  pickContent: (p) => ({ nome: p.nome, descricao: p.descricao }),
  // Zonas são referenciadas por diagnósticos. O diagnóstico tem hospital_id
  // próprio, por isso a desassociação de um hospital pode ser verificada por âmbito.
  usages: [
    {
      table: diagnosticos,
      itemFk: diagnosticos.zonaAnatomicaId,
      deletedAt: diagnosticos.deletedAt,
      hospitalColumn: diagnosticos.hospitalId,
      message: 'Não é possível: está a ser usado por diagnósticos.',
    },
  ],
};

export const procedimentosCatalog: SharedCatalogConfig = {
  entityType: 'procedimento',
  labels: {
    notFound: 'Procedimento não encontrado.',
    duplicate: 'Já existe um procedimento com esse nome.',
  },
  globalNameConstraint: 'procedimentos_nome_global_uq',
  item: {
    table: procedimentos,
    id: procedimentos.id,
    nome: procedimentos.nome,
    isGlobal: procedimentos.isGlobal,
    deletedAt: procedimentos.deletedAt,
  },
  assoc: {
    table: procedimentoHospital,
    id: procedimentoHospital.id,
    itemFk: procedimentoHospital.procedimentoId,
    itemFkKey: 'procedimentoId',
    hospitalId: procedimentoHospital.hospitalId,
    deletedAt: procedimentoHospital.deletedAt,
  },
  pickContent: (p) => ({ nome: p.nome, especialidadeId: p.especialidadeId }),
  dependency: {
    valueKey: 'especialidadeId',
    depItemTable: especialidades,
    depId: especialidades.id,
    depIsGlobal: especialidades.isGlobal,
    depDeletedAt: especialidades.deletedAt,
    depAssocTable: especialidadeHospital,
    depAssocItemFk: especialidadeHospital.especialidadeId,
    depAssocHospitalId: especialidadeHospital.hospitalId,
    depAssocDeletedAt: especialidadeHospital.deletedAt,
    message: 'A especialidade tem de estar disponível no hospital de destino.',
  },
  usages: [
    {
      table: cirurgias,
      itemFk: cirurgias.procedimentoId,
      deletedAt: cirurgias.deletedAt,
      message: 'Não é possível eliminar: está a ser usado em cirurgias.',
    },
  ],
};

export const tiposDeCirurgiaCatalog: SharedCatalogConfig = {
  entityType: 'tipo_de_cirurgia',
  labels: {
    notFound: 'Tipo de cirurgia não encontrado.',
    duplicate: 'Já existe um tipo de cirurgia com esse nome.',
  },
  globalNameConstraint: 'tipo_de_cirurgias_nome_global_uq',
  item: {
    table: tipoDeCirurgias,
    id: tipoDeCirurgias.id,
    nome: tipoDeCirurgias.nome,
    isGlobal: tipoDeCirurgias.isGlobal,
    deletedAt: tipoDeCirurgias.deletedAt,
  },
  assoc: {
    table: tipoDeCirurgiaHospital,
    id: tipoDeCirurgiaHospital.id,
    itemFk: tipoDeCirurgiaHospital.tipoDeCirurgiaId,
    itemFkKey: 'tipoDeCirurgiaId',
    hospitalId: tipoDeCirurgiaHospital.hospitalId,
    deletedAt: tipoDeCirurgiaHospital.deletedAt,
  },
  pickContent: nomeOnly,
  usages: [
    {
      table: registoCirurgicos,
      itemFk: registoCirurgicos.tipoDeCirurgiaId,
      deletedAt: registoCirurgicos.deletedAt,
      hospitalColumn: registoCirurgicos.hospitalId,
      message: 'Não é possível: está a ser usado em registos cirúrgicos.',
    },
  ],
};

export const funcoesCirurgiaoCatalog: SharedCatalogConfig = {
  entityType: 'funcao_cirurgiao',
  labels: {
    notFound: 'Função de cirurgião não encontrada.',
    duplicate: 'Já existe uma função de cirurgião com esse nome.',
  },
  globalNameConstraint: 'funcao_cirurgiaos_nome_global_uq',
  item: {
    table: funcaoCirurgiaos,
    id: funcaoCirurgiaos.id,
    nome: funcaoCirurgiaos.nome,
    isGlobal: funcaoCirurgiaos.isGlobal,
    deletedAt: funcaoCirurgiaos.deletedAt,
  },
  assoc: {
    table: funcaoCirurgiaoHospital,
    id: funcaoCirurgiaoHospital.id,
    itemFk: funcaoCirurgiaoHospital.funcaoCirurgiaoId,
    itemFkKey: 'funcaoCirurgiaoId',
    hospitalId: funcaoCirurgiaoHospital.hospitalId,
    deletedAt: funcaoCirurgiaoHospital.deletedAt,
  },
  pickContent: nomeOnly,
  usages: [
    {
      table: cirurgias,
      itemFk: cirurgias.funcaoCirurgiaoId,
      deletedAt: cirurgias.deletedAt,
      message: 'Não é possível eliminar: está a ser usado em cirurgias.',
    },
  ],
};

export const tiposDeAbordagemCatalog: SharedCatalogConfig = {
  entityType: 'tipo_de_abordagem',
  labels: {
    notFound: 'Tipo de abordagem não encontrado.',
    duplicate: 'Já existe um tipo de abordagem com esse nome.',
  },
  globalNameConstraint: 'tipo_de_abordagens_nome_global_uq',
  item: {
    table: tipoDeAbordagens,
    id: tipoDeAbordagens.id,
    nome: tipoDeAbordagens.nome,
    isGlobal: tipoDeAbordagens.isGlobal,
    deletedAt: tipoDeAbordagens.deletedAt,
  },
  assoc: {
    table: tipoDeAbordagemHospital,
    id: tipoDeAbordagemHospital.id,
    itemFk: tipoDeAbordagemHospital.tipoDeAbordagemId,
    itemFkKey: 'tipoDeAbordagemId',
    hospitalId: tipoDeAbordagemHospital.hospitalId,
    deletedAt: tipoDeAbordagemHospital.deletedAt,
  },
  pickContent: nomeOnly,
  usages: [
    {
      table: registoCirurgicos,
      itemFk: registoCirurgicos.tipoDeAbordagemId,
      deletedAt: registoCirurgicos.deletedAt,
      hospitalColumn: registoCirurgicos.hospitalId,
      message: 'Não é possível: está a ser usado em registos cirúrgicos.',
    },
  ],
};
