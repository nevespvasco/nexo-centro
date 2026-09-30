import { pgEnum } from "drizzle-orm/pg-core";

export const sexoEnum = pgEnum("sexo", ["masculino", "feminino", "outro"]);

export const tipoAtividadeEnum = pgEnum("tipo_atividade", [
  "artigo",
  "comunicacao",
  "congresso",
  "poster",
  "outro",
]);

export const tipoFormacaoEnum = pgEnum("tipo_formacao", [
  "curso",
  "congresso",
  "pos_graduacao",
  "mestrado",
  "doutoramento",
  "outro",
]);

export const tipoLesaoEnum = pgEnum("tipo_lesao", ["benigno", "maligno"]);

// 'sem_complicacoes' é um valor explícito distinto de NULL: distingue "sem complicações
// registadas" de "grau de Clavien-Dindo não preenchido", necessário para a métrica de negócio
// que conta complicações como clavien_dindo preenchido e diferente de "sem complicações".
export const clavienDindoEnum = pgEnum("clavien_dindo", [
  "sem_complicacoes",
  "I",
  "II",
  "IIIa",
  "IIIb",
  "IVa",
  "IVb",
  "V",
]);

// Sem 'rejected': um pedido recusado é soft-deleted (deleted_at) em vez de mudar de estado —
// o índice único parcial (WHERE deleted_at IS NULL) já ignora linhas escondidas, pelo que o
// mesmo utilizador pode voltar a pedir adesão sem conflito.
export const membershipStatusEnum = pgEnum("membership_status", [
  "pending",
  "approved",
]);

export const tipoParticipacaoEnum = pgEnum("tipo_participacao", [
  "participante",
  "orador",
  "organizador",
  "moderador",
]);
