import { config } from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import { createDb } from "./client.js";
import { auditEvents, hospitalUser, hospitals, users } from "./schema/index.js";

config({ quiet: true });

const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const email = process.env.APPROVER_EMAIL?.trim().toLowerCase();
const hospitalId = process.env.APPROVER_HOSPITAL_ID?.trim();

if (!databaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL is required");
}
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error("APPROVER_EMAIL must be a valid email address");
}
if (
  !hospitalId ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    hospitalId,
  )
) {
  throw new Error("APPROVER_HOSPITAL_ID must be a valid UUID");
}

const { db, pool } = createDb(databaseUrl);

async function main(
  approverEmail: string,
  approverHospitalId: string,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.email, approverEmail),
            eq(users.isActive, true),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);
      if (!user) throw new Error("Active user not found");

      const [hospital] = await tx
        .select({ id: hospitals.id })
        .from(hospitals)
        .where(
          and(
            eq(hospitals.id, approverHospitalId),
            isNull(hospitals.deletedAt),
          ),
        )
        .limit(1);
      if (!hospital) throw new Error("Hospital not found");

      const [existing] = await tx
        .select({ id: hospitalUser.id })
        .from(hospitalUser)
        .where(
          and(
            eq(hospitalUser.hospitalId, hospital.id),
            eq(hospitalUser.userId, user.id),
            isNull(hospitalUser.deletedAt),
          ),
        )
        .limit(1);

      const membership = existing
        ? (
            await tx
              .update(hospitalUser)
              .set({
                status: "approved",
                canApproveMembers: true,
                approvedAt: new Date(),
              })
              .where(eq(hospitalUser.id, existing.id))
              .returning({ id: hospitalUser.id })
          )[0]
        : (
            await tx
              .insert(hospitalUser)
              .values({
                hospitalId: hospital.id,
                userId: user.id,
                status: "approved",
                canApproveMembers: true,
                approvedAt: new Date(),
              })
              .returning({ id: hospitalUser.id })
          )[0];
      if (!membership) throw new Error("Could not grant approver membership");

      await tx.insert(auditEvents).values({
        hospitalId: hospital.id,
        action: "hospital.approver_granted",
        entityType: "hospital_user",
        entityId: membership.id,
        after: { userId: user.id, canApproveMembers: true },
      });
    });
    console.log(
      `Approver access granted to ${approverEmail} for hospital ${approverHospitalId}.`,
    );
  } finally {
    await pool.end();
  }
}

main(email, hospitalId).catch((error: unknown) => {
  console.error(
    "Could not grant hospital approver access:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exit(1);
});
