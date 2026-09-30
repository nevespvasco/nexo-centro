import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers.js";
import { membershipStatusEnum } from "./enums.js";
import { users } from "./users.js";

export const hospitals = pgTable(
  "hospitals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: varchar("nome", { length: 255 }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("hospitals_nome_uq")
      .on(table.nome)
      .where(sql`deleted_at is null`),
  ],
);

export const hospitalUser = pgTable(
  "hospital_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hospitalId: uuid("hospital_id")
      .notNull()
      .references(() => hospitals.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: membershipStatusEnum("status").notNull().default("pending"),
    isActive: boolean("is_active").notNull().default(true),
    canApproveMembers: boolean("can_approve_members").notNull().default(false),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("hospital_user_hospital_id_user_id_uq")
      .on(table.hospitalId, table.userId)
      .where(sql`deleted_at is null`),
    index("hospital_user_hospital_id_idx").on(table.hospitalId),
    index("hospital_user_user_id_idx").on(table.userId),
    index("hospital_user_status_idx").on(table.status),
    index("hospital_user_hospital_id_status_idx").on(
      table.hospitalId,
      table.status,
    ),
  ],
);
