import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers.js";
import { tipoLesaoEnum } from "./enums.js";
import { hospitals } from "./hospitals.js";

// Tabelas de referência (especialidades, diagnósticos, etc.) partilham a mesma
// forma: id + nome, um `hospital_id` opcional (NULL = referência global) e os
// timestamps. As três funções abaixo constroem essa forma uma única vez, para
// que o padrão — em especial o predicado dos índices únicos parciais — não
// divirja entre tabelas quando uma delas for editada.
//
// Os builders de coluna são criados de novo em cada chamada (funções, não
// objetos partilhados) para que cada tabela tenha a sua própria instância e o
// nome da foreign key derive corretamente por tabela.

/** Colunas iniciais comuns: id + nome. */
function refHeadColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: varchar("nome", { length: 255 }).notNull(),
  };
}

/** Coluna final comum: hospital_id (opcional). */
function refScopeColumns() {
  return {
    hospitalId: uuid("hospital_id").references(() => hospitals.id, {
      onDelete: "restrict",
    }),
  };
}

// hospital_id NULL = tabela de referência global. Em vez de nullsNotDistinct() (que o
// drizzle-orm 0.45 só suporta em unique() não-parcial), usam-se dois índices únicos parciais
// comuns: um para linhas com hospital (nome único por hospital) e outro só para as globais
// (nome único entre si). Cada um é um partial index normal, sem SQL especial.
function refScopeIndexes(
  name: string,
  table: { hospitalId: AnyPgColumn; nome: AnyPgColumn },
) {
  return [
    uniqueIndex(`${name}_hospital_id_nome_uq`)
      .on(table.hospitalId, table.nome)
      .where(sql`deleted_at is null and hospital_id is not null`),
    uniqueIndex(`${name}_nome_global_uq`)
      .on(table.nome)
      .where(sql`deleted_at is null and hospital_id is null`),
    index(`${name}_hospital_id_idx`).on(table.hospitalId),
  ];
}

export const especialidades = pgTable(
  "especialidades",
  {
    ...refHeadColumns(),
    descricao: varchar("descricao", { length: 255 }),
    ...refScopeColumns(),
    ...timestamps,
  },
  (table) => refScopeIndexes("especialidades", table),
);

export const zonaAnatomicas = pgTable(
  "zona_anatomicas",
  {
    ...refHeadColumns(),
    descricao: text("descricao"),
    ordem: integer("ordem").notNull().default(0),
    ...refScopeColumns(),
    ...timestamps,
  },
  (table) => refScopeIndexes("zona_anatomicas", table),
);

export const diagnosticos = pgTable(
  "diagnosticos",
  {
    ...refHeadColumns(),
    zonaAnatomicaId: uuid("zona_anatomica_id").references(
      () => zonaAnatomicas.id,
      {
        onDelete: "restrict",
      },
    ),
    tipo: tipoLesaoEnum("tipo"),
    descricao: text("descricao"),
    ...refScopeColumns(),
    ...timestamps,
  },
  (table) => [
    ...refScopeIndexes("diagnosticos", table),
    index("diagnosticos_zona_anatomica_id_idx").on(table.zonaAnatomicaId),
  ],
);

export const procedimentos = pgTable(
  "procedimentos",
  {
    ...refHeadColumns(),
    especialidadeId: uuid("especialidade_id").references(
      () => especialidades.id,
      {
        onDelete: "restrict",
      },
    ),
    descricao: text("descricao"),
    ...refScopeColumns(),
    ...timestamps,
  },
  (table) => [
    ...refScopeIndexes("procedimentos", table),
    index("procedimentos_especialidade_id_idx").on(table.especialidadeId),
  ],
);

export const tipoDeCirurgias = pgTable(
  "tipo_de_cirurgias",
  {
    ...refHeadColumns(),
    ...refScopeColumns(),
    ...timestamps,
  },
  (table) => refScopeIndexes("tipo_de_cirurgias", table),
);

export const funcaoCirurgiaos = pgTable(
  "funcao_cirurgiaos",
  {
    ...refHeadColumns(),
    ...refScopeColumns(),
    ...timestamps,
  },
  (table) => refScopeIndexes("funcao_cirurgiaos", table),
);

export const tipoDeAbordagens = pgTable(
  "tipo_de_abordagens",
  {
    ...refHeadColumns(),
    ...refScopeColumns(),
    ...timestamps,
  },
  (table) => refScopeIndexes("tipo_de_abordagens", table),
);
