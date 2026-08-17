import { boolean, date, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_helpers.js';
import { clavienDindoEnum, tipoLesaoEnum } from './enums.js';
import { hospitals } from './hospitals.js';
import { diagnosticos, especialidades, funcaoCirurgiaos, procedimentos, tipoDeAbordagens, tipoDeCirurgias } from './reference.js';
import { users } from './users.js';
import { utentes } from './utentes.js';

export const registoCirurgicos = pgTable(
  'registo_cirurgicos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hospitalId: uuid('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'restrict' }),
    utenteId: uuid('utente_id')
      .notNull()
      .references(() => utentes.id, { onDelete: 'restrict' }),
    especialidadeId: uuid('especialidade_id').references(() => especialidades.id, {
      onDelete: 'restrict',
    }),
    dataCirurgia: date('data_cirurgia').notNull(),
    idadeCirurgia: integer('idade_cirurgia'),
    tipoDeCirurgiaId: uuid('tipo_de_cirurgia_id')
      .notNull()
      .references(() => tipoDeCirurgias.id, { onDelete: 'restrict' }),
    tipoDeAbordagemId: uuid('tipo_de_abordagem_id').references(() => tipoDeAbordagens.id, {
      onDelete: 'restrict',
    }),
    ambulatorio: boolean('ambulatorio').notNull().default(false),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (table) => [
    index('registo_cirurgicos_hospital_id_data_cirurgia_idx').on(
      table.hospitalId,
      table.dataCirurgia,
    ),
    index('registo_cirurgicos_user_id_data_cirurgia_idx').on(table.userId, table.dataCirurgia),
  ],
);

export const cirurgias = pgTable(
  'cirurgias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registoCirurgicoId: uuid('registo_cirurgico_id')
      .notNull()
      .references(() => registoCirurgicos.id, { onDelete: 'restrict' }),
    diagnosticoId: uuid('diagnostico_id')
      .notNull()
      .references(() => diagnosticos.id, { onDelete: 'restrict' }),
    procedimentoId: uuid('procedimento_id')
      .notNull()
      .references(() => procedimentos.id, { onDelete: 'restrict' }),
    tipo: tipoLesaoEnum('tipo'),
    funcaoCirurgiaoId: uuid('funcao_cirurgiao_id').references(() => funcaoCirurgiaos.id, {
      onDelete: 'restrict',
    }),
    clavienDindo: clavienDindoEnum('clavien_dindo'),
    anatomiaPatologica: text('anatomia_patologica'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (table) => [index('cirurgias_registo_cirurgico_id_idx').on(table.registoCirurgicoId)],
);
