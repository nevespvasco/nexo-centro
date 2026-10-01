import { relations } from "drizzle-orm";
import { adminUsers } from "./admin.js";
import { passwordResetTokens } from "./auth.js";
import {
  especialidadeHospital,
  funcaoCirurgiaoHospital,
  procedimentoHospital,
  tipoDeAbordagemHospital,
  tipoDeCirurgiaHospital,
  zonaAnatomicaHospital,
} from "./catalog-hospitals.js";
import { hospitalUser, hospitals } from "./hospitals.js";
import { atividadesCientificas, formacoes } from "./portfolio.js";
import {
  diagnosticos,
  especialidades,
  funcaoCirurgiaos,
  procedimentos,
  tipoDeAbordagens,
  tipoDeCirurgias,
  zonaAnatomicas,
} from "./reference.js";
import { cirurgias, registoCirurgicos } from "./registos.js";
import { users } from "./users.js";
import { utentes } from "./utentes.js";

export const usersRelations = relations(users, ({ one, many }) => ({
  especialidade: one(especialidades, {
    fields: [users.especialidadeId],
    references: [especialidades.id],
  }),
  hospitalMemberships: many(hospitalUser, {
    relationName: "hospitalUser_user",
  }),
  approvedMemberships: many(hospitalUser, {
    relationName: "hospitalUser_approvedBy",
  }),
  utentesCriados: many(utentes),
  registoCirurgicos: many(registoCirurgicos),
  atividadesCientificas: many(atividadesCientificas),
  formacoes: many(formacoes),
  passwordResetTokens: many(passwordResetTokens),
}));

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const hospitalsRelations = relations(hospitals, ({ many }) => ({
  memberships: many(hospitalUser),
  utentes: many(utentes),
  registoCirurgicos: many(registoCirurgicos),
  diagnosticos: many(diagnosticos),
  especialidadeAssociacoes: many(especialidadeHospital),
  zonaAnatomicaAssociacoes: many(zonaAnatomicaHospital),
  procedimentoAssociacoes: many(procedimentoHospital),
  tipoDeCirurgiaAssociacoes: many(tipoDeCirurgiaHospital),
  funcaoCirurgiaoAssociacoes: many(funcaoCirurgiaoHospital),
  tipoDeAbordagemAssociacoes: many(tipoDeAbordagemHospital),
  adminUsers: many(adminUsers),
}));

export const adminUsersRelations = relations(adminUsers, ({ one }) => ({
  hospital: one(hospitals, {
    fields: [adminUsers.hospitalId],
    references: [hospitals.id],
  }),
}));

export const hospitalUserRelations = relations(hospitalUser, ({ one }) => ({
  hospital: one(hospitals, {
    fields: [hospitalUser.hospitalId],
    references: [hospitals.id],
  }),
  user: one(users, {
    fields: [hospitalUser.userId],
    references: [users.id],
    relationName: "hospitalUser_user",
  }),
  approvedByUser: one(users, {
    fields: [hospitalUser.approvedByUserId],
    references: [users.id],
    relationName: "hospitalUser_approvedBy",
  }),
}));

export const especialidadesRelations = relations(
  especialidades,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [especialidades.createdByUserId],
      references: [users.id],
    }),
    associacoes: many(especialidadeHospital),
    users: many(users),
    procedimentos: many(procedimentos),
    registoCirurgicos: many(registoCirurgicos),
  }),
);

export const zonaAnatomicasRelations = relations(
  zonaAnatomicas,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [zonaAnatomicas.createdByUserId],
      references: [users.id],
    }),
    associacoes: many(zonaAnatomicaHospital),
    diagnosticos: many(diagnosticos),
  }),
);

export const diagnosticosRelations = relations(
  diagnosticos,
  ({ one, many }) => ({
    hospital: one(hospitals, {
      fields: [diagnosticos.hospitalId],
      references: [hospitals.id],
    }),
    zonaAnatomica: one(zonaAnatomicas, {
      fields: [diagnosticos.zonaAnatomicaId],
      references: [zonaAnatomicas.id],
    }),
    cirurgias: many(cirurgias),
  }),
);

export const procedimentosRelations = relations(
  procedimentos,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [procedimentos.createdByUserId],
      references: [users.id],
    }),
    associacoes: many(procedimentoHospital),
    especialidade: one(especialidades, {
      fields: [procedimentos.especialidadeId],
      references: [especialidades.id],
    }),
    cirurgias: many(cirurgias),
  }),
);

export const tipoDeCirurgiasRelations = relations(
  tipoDeCirurgias,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [tipoDeCirurgias.createdByUserId],
      references: [users.id],
    }),
    associacoes: many(tipoDeCirurgiaHospital),
    registoCirurgicos: many(registoCirurgicos),
  }),
);

export const funcaoCirurgiaosRelations = relations(
  funcaoCirurgiaos,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [funcaoCirurgiaos.createdByUserId],
      references: [users.id],
    }),
    associacoes: many(funcaoCirurgiaoHospital),
    cirurgias: many(cirurgias),
  }),
);

export const tipoDeAbordagensRelations = relations(
  tipoDeAbordagens,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [tipoDeAbordagens.createdByUserId],
      references: [users.id],
    }),
    associacoes: many(tipoDeAbordagemHospital),
    registoCirurgicos: many(registoCirurgicos),
  }),
);

// Relações das tabelas de associação catálogo↔hospital.
export const especialidadeHospitalRelations = relations(
  especialidadeHospital,
  ({ one }) => ({
    especialidade: one(especialidades, {
      fields: [especialidadeHospital.especialidadeId],
      references: [especialidades.id],
    }),
    hospital: one(hospitals, {
      fields: [especialidadeHospital.hospitalId],
      references: [hospitals.id],
    }),
    createdByUser: one(users, {
      fields: [especialidadeHospital.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const zonaAnatomicaHospitalRelations = relations(
  zonaAnatomicaHospital,
  ({ one }) => ({
    zonaAnatomica: one(zonaAnatomicas, {
      fields: [zonaAnatomicaHospital.zonaAnatomicaId],
      references: [zonaAnatomicas.id],
    }),
    hospital: one(hospitals, {
      fields: [zonaAnatomicaHospital.hospitalId],
      references: [hospitals.id],
    }),
    createdByUser: one(users, {
      fields: [zonaAnatomicaHospital.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const procedimentoHospitalRelations = relations(
  procedimentoHospital,
  ({ one }) => ({
    procedimento: one(procedimentos, {
      fields: [procedimentoHospital.procedimentoId],
      references: [procedimentos.id],
    }),
    hospital: one(hospitals, {
      fields: [procedimentoHospital.hospitalId],
      references: [hospitals.id],
    }),
    createdByUser: one(users, {
      fields: [procedimentoHospital.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const tipoDeCirurgiaHospitalRelations = relations(
  tipoDeCirurgiaHospital,
  ({ one }) => ({
    tipoDeCirurgia: one(tipoDeCirurgias, {
      fields: [tipoDeCirurgiaHospital.tipoDeCirurgiaId],
      references: [tipoDeCirurgias.id],
    }),
    hospital: one(hospitals, {
      fields: [tipoDeCirurgiaHospital.hospitalId],
      references: [hospitals.id],
    }),
    createdByUser: one(users, {
      fields: [tipoDeCirurgiaHospital.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const funcaoCirurgiaoHospitalRelations = relations(
  funcaoCirurgiaoHospital,
  ({ one }) => ({
    funcaoCirurgiao: one(funcaoCirurgiaos, {
      fields: [funcaoCirurgiaoHospital.funcaoCirurgiaoId],
      references: [funcaoCirurgiaos.id],
    }),
    hospital: one(hospitals, {
      fields: [funcaoCirurgiaoHospital.hospitalId],
      references: [hospitals.id],
    }),
    createdByUser: one(users, {
      fields: [funcaoCirurgiaoHospital.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const tipoDeAbordagemHospitalRelations = relations(
  tipoDeAbordagemHospital,
  ({ one }) => ({
    tipoDeAbordagem: one(tipoDeAbordagens, {
      fields: [tipoDeAbordagemHospital.tipoDeAbordagemId],
      references: [tipoDeAbordagens.id],
    }),
    hospital: one(hospitals, {
      fields: [tipoDeAbordagemHospital.hospitalId],
      references: [hospitals.id],
    }),
    createdByUser: one(users, {
      fields: [tipoDeAbordagemHospital.createdByUserId],
      references: [users.id],
    }),
  }),
);

export const utentesRelations = relations(utentes, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [utentes.hospitalId],
    references: [hospitals.id],
  }),
  createdByUser: one(users, {
    fields: [utentes.createdByUserId],
    references: [users.id],
  }),
  registoCirurgicos: many(registoCirurgicos),
}));

export const registoCirurgicosRelations = relations(
  registoCirurgicos,
  ({ one, many }) => ({
    hospital: one(hospitals, {
      fields: [registoCirurgicos.hospitalId],
      references: [hospitals.id],
    }),
    user: one(users, {
      fields: [registoCirurgicos.userId],
      references: [users.id],
    }),
    utente: one(utentes, {
      fields: [registoCirurgicos.utenteId],
      references: [utentes.id],
    }),
    especialidade: one(especialidades, {
      fields: [registoCirurgicos.especialidadeId],
      references: [especialidades.id],
    }),
    tipoDeCirurgia: one(tipoDeCirurgias, {
      fields: [registoCirurgicos.tipoDeCirurgiaId],
      references: [tipoDeCirurgias.id],
    }),
    tipoDeAbordagem: one(tipoDeAbordagens, {
      fields: [registoCirurgicos.tipoDeAbordagemId],
      references: [tipoDeAbordagens.id],
    }),
    cirurgias: many(cirurgias),
  }),
);

export const cirurgiasRelations = relations(cirurgias, ({ one }) => ({
  registoCirurgico: one(registoCirurgicos, {
    fields: [cirurgias.registoCirurgicoId],
    references: [registoCirurgicos.id],
  }),
  diagnostico: one(diagnosticos, {
    fields: [cirurgias.diagnosticoId],
    references: [diagnosticos.id],
  }),
  procedimento: one(procedimentos, {
    fields: [cirurgias.procedimentoId],
    references: [procedimentos.id],
  }),
  funcaoCirurgiao: one(funcaoCirurgiaos, {
    fields: [cirurgias.funcaoCirurgiaoId],
    references: [funcaoCirurgiaos.id],
  }),
}));

export const atividadesCientificasRelations = relations(
  atividadesCientificas,
  ({ one }) => ({
    user: one(users, {
      fields: [atividadesCientificas.userId],
      references: [users.id],
    }),
  }),
);

export const formacoesRelations = relations(formacoes, ({ one }) => ({
  user: one(users, {
    fields: [formacoes.userId],
    references: [users.id],
  }),
}));
