import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_helpers.js';
import { tipoLesaoEnum } from './enums.js';
import { hospitals } from './hospitals.js';

// hospital_id NULL = tabela de referência global. Em vez de nullsNotDistinct() (que o
// drizzle-orm 0.45 só suporta em unique() não-parcial), usam-se dois índices únicos parciais
// comuns: um para linhas com hospital (nome único por hospital) e outro só para as globais
// (nome único entre si). Cada um é um partial index normal, sem SQL especial.
export const especialidades = pgTable(
  'especialidades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    descricao: varchar('descricao', { length: 255 }),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'restrict' }),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('especialidades_hospital_id_nome_uq')
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex('especialidades_nome_global_uq')
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index('especialidades_hospital_id_idx').on(table.hospitalId),
  ],
);

export const zonaAnatomicas = pgTable(
  'zona_anatomicas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    descricao: text('descricao'),
    ordem: integer('ordem').notNull().default(0),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'restrict' }),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('zona_anatomicas_hospital_id_nome_uq')
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex('zona_anatomicas_nome_global_uq')
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index('zona_anatomicas_hospital_id_idx').on(table.hospitalId),
  ],
);

export const diagnosticos = pgTable(
  'diagnosticos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    zonaAnatomicaId: uuid('zona_anatomica_id').references(() => zonaAnatomicas.id, {
      onDelete: 'restrict',
    }),
    tipo: tipoLesaoEnum('tipo'),
    descricao: text('descricao'),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'restrict' }),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('diagnosticos_hospital_id_nome_uq')
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex('diagnosticos_nome_global_uq')
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index('diagnosticos_hospital_id_idx').on(table.hospitalId),
    index('diagnosticos_zona_anatomica_id_idx').on(table.zonaAnatomicaId),
  ],
);

export const procedimentos = pgTable(
  'procedimentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    especialidadeId: uuid('especialidade_id').references(() => especialidades.id, {
      onDelete: 'restrict',
    }),
    descricao: text('descricao'),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'restrict' }),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('procedimentos_hospital_id_nome_uq')
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex('procedimentos_nome_global_uq')
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index('procedimentos_hospital_id_idx').on(table.hospitalId),
    index('procedimentos_especialidade_id_idx').on(table.especialidadeId),
  ],
);

export const tipoDeCirurgias = pgTable(
  'tipo_de_cirurgias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'restrict' }),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('tipo_de_cirurgias_hospital_id_nome_uq')
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex('tipo_de_cirurgias_nome_global_uq')
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index('tipo_de_cirurgias_hospital_id_idx').on(table.hospitalId),
  ],
);

export const funcaoCirurgiaos = pgTable(
  'funcao_cirurgiaos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'restrict' }),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('funcao_cirurgiaos_hospital_id_nome_uq')
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex('funcao_cirurgiaos_nome_global_uq')
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index('funcao_cirurgiaos_hospital_id_idx').on(table.hospitalId),
  ],
);

export const tipoDeAbordagens = pgTable(
  'tipo_de_abordagens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    hospitalId: uuid('hospital_id').references(() => hospitals.id, { onDelete: 'restrict' }),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('tipo_de_abordagens_hospital_id_nome_uq')
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex('tipo_de_abordagens_nome_global_uq')
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index('tipo_de_abordagens_hospital_id_idx').on(table.hospitalId),
  ],
);
