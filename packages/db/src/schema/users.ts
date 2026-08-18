import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_helpers.js';
import { encryptedText } from '../crypto.js';
import { especialidades } from './reference.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }),
    email: varchar('email', { length: 255 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    especialidadeId: uuid('especialidade_id').references(() => especialidades.id, {
      onDelete: 'restrict',
    }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    // Encriptado at-rest (AES-256-GCM). Segredo em claro só em memória.
    twoFactorSecret: encryptedText('two_factor_secret'),
    // Guarda os códigos de recuperação COM HASH (argon2, one-time-use),
    // aplicado na camada de serviço quando forem gerados.
    twoFactorRecoveryCodes: text('two_factor_recovery_codes'),
    twoFactorConfirmedAt: timestamp('two_factor_confirmed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_email_uq').on(table.email).where(sql`deleted_at is null`),
    index('users_especialidade_id_idx').on(table.especialidadeId),
    index('users_is_active_idx').on(table.isActive),
  ],
);

/**
 * Colunas de `users` sem segredos (password, 2FA). Usar por defeito em
 * qualquer select fora do fluxo de autenticação/verificação — o
 * `encryptedText` desencripta sempre que a coluna é selecionada, por isso
 * omiti-la aqui é a única barreira contra expor o segredo sem querer.
 */
export const usersSafeColumns = {
  id: users.id,
  nome: users.nome,
  email: users.email,
  isActive: users.isActive,
  especialidadeId: users.especialidadeId,
  emailVerifiedAt: users.emailVerifiedAt,
  twoFactorConfirmedAt: users.twoFactorConfirmedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
};
