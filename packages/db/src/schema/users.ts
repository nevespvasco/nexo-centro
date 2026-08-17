import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_helpers.js';
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
    twoFactorSecret: text('two_factor_secret'),
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
