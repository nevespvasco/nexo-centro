import { sql } from 'drizzle-orm';
import { index, integer, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_helpers.js';
import { sexoEnum } from './enums.js';
import { hospitals } from './hospitals.js';
import { users } from './users.js';

export const utentes = pgTable(
  'utentes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable de propósito (RGPD): permite anonimizar mantendo o registo clínico.
    nome: varchar('nome', { length: 255 }),
    sexo: sexoEnum('sexo'),
    processo: integer('processo').notNull(),
    hospitalId: uuid('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'restrict' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('utentes_hospital_id_processo_uq')
      .on(table.hospitalId, table.processo)
      .where(sql`deleted_at is null`),
    index('utentes_hospital_id_idx').on(table.hospitalId),
  ],
);
