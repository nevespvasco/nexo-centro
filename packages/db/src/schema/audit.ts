import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { hospitals } from "./hospitals.js";
import { users } from "./users.js";
import { adminUsers } from "./admin.js";

/**
 * Registo append-only de alterações sensíveis. A aplicação nunca expõe endpoints
 * de update/delete para esta tabela.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorAdminUserId: uuid("actor_admin_user_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    hospitalId: uuid("hospital_id").references(() => hospitals.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_actor_user_id_idx").on(table.actorUserId),
    index("audit_events_hospital_id_occurred_at_idx").on(
      table.hospitalId,
      table.occurredAt,
    ),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);
