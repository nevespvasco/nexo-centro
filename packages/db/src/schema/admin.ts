import { sql } from 'drizzle-orm';
import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_helpers.js';

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('admin_users_email_uq').on(table.email).where(sql`deleted_at is null`)],
);
