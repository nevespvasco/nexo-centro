import { relations } from 'drizzle-orm';
import { adminUsers } from './admin.js';
import { hospitalUser, hospitals } from './hospitals.js';
import { atividadesCientificas, formacoes } from './portfolio.js';
import { permissions, roleHasPermissions, roles } from './permissions.js';
import {
  diagnosticos,
  especialidades,
  funcaoCirurgiaos,
  procedimentos,
  tipoDeAbordagens,
  tipoDeCirurgias,
  zonaAnatomicas,
} from './reference.js';
import { cirurgias, registoCirurgicos } from './registos.js';
import { users } from './users.js';
import { utentes } from './utentes.js';

export const usersRelations = relations(users, ({ one, many }) => ({
  especialidade: one(especialidades, {
    fields: [users.especialidadeId],
    references: [especialidades.id],
  }),
  hospitalMemberships: many(hospitalUser, { relationName: 'hospitalUser_user' }),
  approvedMemberships: many(hospitalUser, { relationName: 'hospitalUser_approvedBy' }),
  utentesCriados: many(utentes),
  registoCirurgicos: many(registoCirurgicos),
  atividadesCientificas: many(atividadesCientificas),
  formacoes: many(formacoes),
}));

export const hospitalsRelations = relations(hospitals, ({ many }) => ({
  memberships: many(hospitalUser),
  utentes: many(utentes),
  registoCirurgicos: many(registoCirurgicos),
  especialidades: many(especialidades),
  zonaAnatomicas: many(zonaAnatomicas),
  diagnosticos: many(diagnosticos),
  procedimentos: many(procedimentos),
  tipoDeCirurgias: many(tipoDeCirurgias),
  funcaoCirurgiaos: many(funcaoCirurgiaos),
  tipoDeAbordagens: many(tipoDeAbordagens),
}));

export const hospitalUserRelations = relations(hospitalUser, ({ one }) => ({
  hospital: one(hospitals, {
    fields: [hospitalUser.hospitalId],
    references: [hospitals.id],
  }),
  user: one(users, {
    fields: [hospitalUser.userId],
    references: [users.id],
    relationName: 'hospitalUser_user',
  }),
  approvedByUser: one(users, {
    fields: [hospitalUser.approvedByUserId],
    references: [users.id],
    relationName: 'hospitalUser_approvedBy',
  }),
}));

export const especialidadesRelations = relations(especialidades, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [especialidades.hospitalId],
    references: [hospitals.id],
  }),
  users: many(users),
  procedimentos: many(procedimentos),
  registoCirurgicos: many(registoCirurgicos),
}));

export const zonaAnatomicasRelations = relations(zonaAnatomicas, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [zonaAnatomicas.hospitalId],
    references: [hospitals.id],
  }),
  diagnosticos: many(diagnosticos),
}));

export const diagnosticosRelations = relations(diagnosticos, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [diagnosticos.hospitalId],
    references: [hospitals.id],
  }),
  zonaAnatomica: one(zonaAnatomicas, {
    fields: [diagnosticos.zonaAnatomicaId],
    references: [zonaAnatomicas.id],
  }),
  cirurgias: many(cirurgias),
}));

export const procedimentosRelations = relations(procedimentos, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [procedimentos.hospitalId],
    references: [hospitals.id],
  }),
  especialidade: one(especialidades, {
    fields: [procedimentos.especialidadeId],
    references: [especialidades.id],
  }),
  cirurgias: many(cirurgias),
}));

export const tipoDeCirurgiasRelations = relations(tipoDeCirurgias, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [tipoDeCirurgias.hospitalId],
    references: [hospitals.id],
  }),
  registoCirurgicos: many(registoCirurgicos),
}));

export const funcaoCirurgiaosRelations = relations(funcaoCirurgiaos, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [funcaoCirurgiaos.hospitalId],
    references: [hospitals.id],
  }),
  cirurgias: many(cirurgias),
}));

export const tipoDeAbordagensRelations = relations(tipoDeAbordagens, ({ one, many }) => ({
  hospital: one(hospitals, {
    fields: [tipoDeAbordagens.hospitalId],
    references: [hospitals.id],
  }),
  registoCirurgicos: many(registoCirurgicos),
}));

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

export const registoCirurgicosRelations = relations(registoCirurgicos, ({ one, many }) => ({
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
}));

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

export const atividadesCientificasRelations = relations(atividadesCientificas, ({ one }) => ({
  user: one(users, {
    fields: [atividadesCientificas.userId],
    references: [users.id],
  }),
}));

export const formacoesRelations = relations(formacoes, ({ one }) => ({
  user: one(users, {
    fields: [formacoes.userId],
    references: [users.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  roleHasPermissions: many(roleHasPermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roleHasPermissions: many(roleHasPermissions),
}));

export const roleHasPermissionsRelations = relations(roleHasPermissions, ({ one }) => ({
  role: one(roles, {
    fields: [roleHasPermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [roleHasPermissions.permissionId],
    references: [permissions.id],
  }),
}));
