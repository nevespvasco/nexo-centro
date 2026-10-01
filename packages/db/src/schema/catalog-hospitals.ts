import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers.js";
import { hospitals } from "./hospitals.js";
import {
  especialidades,
  funcaoCirurgiaos,
  procedimentos,
  tipoDeAbordagens,
  tipoDeCirurgias,
  zonaAnatomicas,
} from "./reference.js";
import { users } from "./users.js";

// Associações N:N entre um catálogo partilhável e os hospitais onde está
// disponível. O item (em reference.ts) mantém id/conteúdo únicos; associar ou
// desassociar apenas cria/soft-deleta linhas aqui. `is_global` no item dispensa
// associações (visível em todos os hospitais).
//
// A desassociação é lógica (deleted_at) para preservar histórico e auditoria; o
// índice único parcial ignora linhas escondidas, pelo que a mesma associação
// pode ser recriada depois de removida.

/** Hospital de destino + criador da associação, comuns a todas as tabelas. */
function assocScopeColumns() {
  return {
    hospitalId: uuid("hospital_id")
      .notNull()
      .references(() => hospitals.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  };
}

function assocIndexes(
  name: string,
  itemColumn: AnyPgColumn,
  table: { hospitalId: AnyPgColumn },
) {
  return [
    uniqueIndex(`${name}_item_hospital_uq`)
      .on(itemColumn, table.hospitalId)
      .where(sql`deleted_at is null`),
    index(`${name}_hospital_id_idx`).on(table.hospitalId),
    index(`${name}_item_idx`).on(itemColumn),
  ];
}

export const especialidadeHospital = pgTable(
  "especialidade_hospital",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    especialidadeId: uuid("especialidade_id")
      .notNull()
      .references(() => especialidades.id, { onDelete: "restrict" }),
    ...assocScopeColumns(),
    ...timestamps,
  },
  (table) =>
    assocIndexes("especialidade_hospital", table.especialidadeId, table),
);

export const zonaAnatomicaHospital = pgTable(
  "zona_anatomica_hospital",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    zonaAnatomicaId: uuid("zona_anatomica_id")
      .notNull()
      .references(() => zonaAnatomicas.id, { onDelete: "restrict" }),
    ...assocScopeColumns(),
    // Ordem da zona neste hospital (a partilha permite ordens diferentes por hospital).
    ordem: integer("ordem").notNull().default(0),
    ...timestamps,
  },
  (table) =>
    assocIndexes("zona_anatomica_hospital", table.zonaAnatomicaId, table),
);

export const procedimentoHospital = pgTable(
  "procedimento_hospital",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    procedimentoId: uuid("procedimento_id")
      .notNull()
      .references(() => procedimentos.id, { onDelete: "restrict" }),
    ...assocScopeColumns(),
    ...timestamps,
  },
  (table) => assocIndexes("procedimento_hospital", table.procedimentoId, table),
);

export const tipoDeCirurgiaHospital = pgTable(
  "tipo_de_cirurgia_hospital",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipoDeCirurgiaId: uuid("tipo_de_cirurgia_id")
      .notNull()
      .references(() => tipoDeCirurgias.id, { onDelete: "restrict" }),
    ...assocScopeColumns(),
    ...timestamps,
  },
  (table) =>
    assocIndexes("tipo_de_cirurgia_hospital", table.tipoDeCirurgiaId, table),
);

export const funcaoCirurgiaoHospital = pgTable(
  "funcao_cirurgiao_hospital",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    funcaoCirurgiaoId: uuid("funcao_cirurgiao_id")
      .notNull()
      .references(() => funcaoCirurgiaos.id, { onDelete: "restrict" }),
    ...assocScopeColumns(),
    ...timestamps,
  },
  (table) =>
    assocIndexes("funcao_cirurgiao_hospital", table.funcaoCirurgiaoId, table),
);

export const tipoDeAbordagemHospital = pgTable(
  "tipo_de_abordagem_hospital",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tipoDeAbordagemId: uuid("tipo_de_abordagem_id")
      .notNull()
      .references(() => tipoDeAbordagens.id, { onDelete: "restrict" }),
    ...assocScopeColumns(),
    ...timestamps,
  },
  (table) =>
    assocIndexes("tipo_de_abordagem_hospital", table.tipoDeAbordagemId, table),
);
