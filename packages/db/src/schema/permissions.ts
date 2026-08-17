import { index, pgTable, primaryKey, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditOnly } from './_helpers.js';

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    guardName: varchar('guard_name', { length: 255 }).notNull(),
    ...auditOnly,
  },
  (table) => [uniqueIndex('roles_nome_guard_name_uq').on(table.nome, table.guardName)],
);

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    guardName: varchar('guard_name', { length: 255 }).notNull(),
    ...auditOnly,
  },
  (table) => [uniqueIndex('permissions_nome_guard_name_uq').on(table.nome, table.guardName)],
);

export const modelHasPermissions = pgTable(
  'model_has_permissions',
  {
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'restrict' }),
    modelType: varchar('model_type', { length: 255 }).notNull(),
    modelId: uuid('model_id').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'model_has_permissions_pkey',
      columns: [table.permissionId, table.modelId, table.modelType],
    }),
    index('model_has_permissions_model_id_idx').on(table.modelId),
    index('model_has_permissions_model_type_idx').on(table.modelType),
  ],
);

export const modelHasRoles = pgTable(
  'model_has_roles',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    modelType: varchar('model_type', { length: 255 }).notNull(),
    modelId: uuid('model_id').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'model_has_roles_pkey',
      columns: [table.roleId, table.modelId, table.modelType],
    }),
    index('model_has_roles_model_id_idx').on(table.modelId),
    index('model_has_roles_model_type_idx').on(table.modelType),
  ],
);

export const roleHasPermissions = pgTable(
  'role_has_permissions',
  {
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'restrict' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({
      name: 'role_has_permissions_pkey',
      columns: [table.permissionId, table.roleId],
    }),
  ],
);
