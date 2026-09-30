import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers.js";
import { encryptedText } from "../crypto.js";
import { hospitals } from "./hospitals.js";

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: varchar("nome", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sessionVersion: integer("session_version").notNull().default(1),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    loginLockedUntil: timestamp("login_locked_until", { withTimezone: true }),
    failedTwoFactorAttempts: integer("failed_two_factor_attempts")
      .notNull()
      .default(0),
    twoFactorLockedUntil: timestamp("two_factor_locked_until", {
      withTimezone: true,
    }),
    // NULL = super-admin da plataforma; preenchido = admin restrito a esse hospital.
    hospitalId: uuid("hospital_id").references(() => hospitals.id, {
      onDelete: "restrict",
    }),
    // Encriptado at-rest (AES-256-GCM). Segredo em claro só em memória.
    twoFactorSecret: encryptedText("two_factor_secret"),
    // Guarda os códigos de recuperação COM HASH (argon2, one-time-use),
    // aplicado na camada de serviço quando forem gerados.
    twoFactorRecoveryCodes: text("two_factor_recovery_codes"),
    twoFactorConfirmedAt: timestamp("two_factor_confirmed_at", {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("admin_users_email_uq")
      .on(table.email)
      .where(sql`deleted_at is null`),
    index("admin_users_hospital_id_idx").on(table.hospitalId),
  ],
);

/**
 * Colunas de `admin_users` sem segredos (password, 2FA). Usar por defeito em
 * qualquer select fora do fluxo de autenticação/verificação — o
 * `encryptedText` desencripta sempre que a coluna é selecionada, por isso
 * omiti-la aqui é a única barreira contra expor o segredo sem querer.
 */
export const adminUsersSafeColumns = {
  id: adminUsers.id,
  nome: adminUsers.nome,
  email: adminUsers.email,
  isActive: adminUsers.isActive,
  hospitalId: adminUsers.hospitalId,
  twoFactorConfirmedAt: adminUsers.twoFactorConfirmedAt,
  createdAt: adminUsers.createdAt,
  updatedAt: adminUsers.updatedAt,
  deletedAt: adminUsers.deletedAt,
};
