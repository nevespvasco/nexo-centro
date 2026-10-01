import { sql } from "drizzle-orm";
import {
  boolean,
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
import { users } from "./users.js";

// Tabelas de referência. Dois modelos convivem:
//
// 1. Catálogos PARTILHÁVEIS (especialidades, zona_anatomicas, procedimentos,
//    tipo_de_cirurgias, funcao_cirurgiaos, tipo_de_abordagens): o item tem um
//    único id/conteúdo e associa-se a N hospitais através de uma tabela de
//    associação (ver catalog-hospitals.ts). `is_global = true` marca itens
//    visíveis em todos os hospitais (antes: hospital_id IS NULL). `created_by_user_id`
//    guarda o criador (NULL = legado, só editável por administrador).
//
// 2. Diagnósticos: NÃO é partilhável (por decisão de produto). Mantém o modelo
//    antigo de âmbito único — `hospital_id` opcional, NULL = referência global.
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

// --- Catálogos partilháveis ---------------------------------------------------

/**
 * Colunas de propriedade dos catálogos partilháveis. O âmbito hospitalar já não
 * vive aqui (passou para as tabelas de associação); resta a marca de item global
 * e o criador.
 */
function sharedOwnershipColumns() {
  return {
    isGlobal: boolean("is_global").notNull().default(false),
    // Anotação AnyPgColumn: users referencia especialidades (especialidade_id) e
    // estas referenciam users (created_by), um ciclo que o TS não consegue inferir
    // sem anotar explicitamente o tipo de retorno do callback.
    createdByUserId: uuid("created_by_user_id").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
  };
}

// Sem hospital_id, o único unique index de nomes que faz sentido ao nível da
// tabela é o dos itens globais (nome único entre globais). Os conflitos de nome
// dentro de um hospital envolvem itens de vários âmbitos (global + associados) e
// são validados na camada de serviço.
function sharedRefIndexes(
  name: string,
  table: { nome: AnyPgColumn; createdByUserId: AnyPgColumn },
) {
  return [
    uniqueIndex(`${name}_nome_global_uq`)
      .on(table.nome)
      .where(sql`deleted_at is null and is_global`),
    index(`${name}_created_by_user_id_idx`).on(table.createdByUserId),
  ];
}

// --- Diagnósticos (âmbito único, não partilhável) -----------------------------

/** Coluna de âmbito para diagnósticos: hospital_id (opcional, NULL = global). */
function diagScopeColumns() {
  return {
    hospitalId: uuid("hospital_id").references(() => hospitals.id, {
      onDelete: "restrict",
    }),
  };
}

// hospital_id NULL = referência global. Dois índices únicos parciais: nome único
// por hospital e nome único entre os globais.
function diagScopeIndexes(
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
    ...sharedOwnershipColumns(),
    ...timestamps,
  },
  (table) => sharedRefIndexes("especialidades", table),
);

export const zonaAnatomicas = pgTable(
  "zona_anatomicas",
  {
    ...refHeadColumns(),
    descricao: text("descricao"),
    // Ordem por defeito / dos itens globais. A ordem por hospital dos itens
    // associados vive em zona_anatomica_hospital.ordem (ver catalog-hospitals.ts).
    ordem: integer("ordem").notNull().default(0),
    ...sharedOwnershipColumns(),
    ...timestamps,
  },
  (table) => sharedRefIndexes("zona_anatomicas", table),
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
    ...diagScopeColumns(),
    ...timestamps,
  },
  (table) => [
    ...diagScopeIndexes("diagnosticos", table),
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
    ...sharedOwnershipColumns(),
    ...timestamps,
  },
  (table) => [
    ...sharedRefIndexes("procedimentos", table),
    index("procedimentos_especialidade_id_idx").on(table.especialidadeId),
  ],
);

export const tipoDeCirurgias = pgTable(
  "tipo_de_cirurgias",
  {
    ...refHeadColumns(),
    ...sharedOwnershipColumns(),
    ...timestamps,
  },
  (table) => sharedRefIndexes("tipo_de_cirurgias", table),
);

export const funcaoCirurgiaos = pgTable(
  "funcao_cirurgiaos",
  {
    ...refHeadColumns(),
    ...sharedOwnershipColumns(),
    ...timestamps,
  },
  (table) => sharedRefIndexes("funcao_cirurgiaos", table),
);

export const tipoDeAbordagens = pgTable(
  "tipo_de_abordagens",
  {
    ...refHeadColumns(),
    ...sharedOwnershipColumns(),
    ...timestamps,
  },
  (table) => sharedRefIndexes("tipo_de_abordagens", table),
);
