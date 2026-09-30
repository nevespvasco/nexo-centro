import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers.js";
import {
  tipoAtividadeEnum,
  tipoFormacaoEnum,
  tipoParticipacaoEnum,
} from "./enums.js";
import { users } from "./users.js";

export const atividadesCientificas = pgTable(
  "atividades_cientificas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    tipo: tipoAtividadeEnum("tipo").notNull(),
    data: date("data").notNull(),
    autorPrincipal: boolean("autor_principal").notNull().default(false),
    posicaoAutor: integer("posicao_autor"),
    fatorImpacto: decimal("fator_impacto", { precision: 8, scale: 3 }),
    ficheiroPath: varchar("ficheiro_path", { length: 255 }),
    descricao: text("descricao"),
    revistaConferencia: varchar("revista_conferencia", { length: 255 }),
    localizacao: varchar("localizacao", { length: 255 }),
    categoria: varchar("categoria", { length: 50 }),
    autores: varchar("autores", { length: 1000 }),
    doi: varchar("doi", { length: 255 }),
    isbn: varchar("isbn", { length: 50 }),
    link: varchar("link", { length: 500 }),
    observacoes: text("observacoes"),
    ficheiroOriginalName: varchar("ficheiro_original_name", { length: 255 }),
    ficheiroSize: integer("ficheiro_size"),
    ...timestamps,
  },
  (table) => [
    index("atividades_cientificas_user_id_idx").on(table.userId),
    index("atividades_cientificas_tipo_idx").on(table.tipo),
    index("atividades_cientificas_data_idx").on(table.data),
  ],
);

export const formacoes = pgTable(
  "formacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    tipo: tipoFormacaoEnum("tipo").notNull(),
    dataInicio: date("data_inicio").notNull(),
    dataFim: date("data_fim"),
    duracaoHoras: integer("duracao_horas"),
    creditos: decimal("creditos", { precision: 8, scale: 2 }),
    certificadoPath: varchar("certificado_path", { length: 255 }),
    descricao: text("descricao"),
    entidadeOrganizadora: varchar("entidade_organizadora", { length: 255 }),
    localizacao: varchar("localizacao", { length: 255 }),
    categoria: varchar("categoria", { length: 50 }),
    tipoParticipacao: tipoParticipacaoEnum("tipo_participacao"),
    temaApresentacao: varchar("tema_apresentacao", { length: 500 }),
    observacoes: text("observacoes"),
    certificadoOriginalName: varchar("certificado_original_name", {
      length: 255,
    }),
    certificadoSize: integer("certificado_size"),
    ...timestamps,
  },
  (table) => [
    index("formacoes_user_id_idx").on(table.userId),
    index("formacoes_tipo_idx").on(table.tipo),
    index("formacoes_data_inicio_idx").on(table.dataInicio),
    check("formacoes_datas_check", sql`data_fim >= data_inicio`),
  ],
);
