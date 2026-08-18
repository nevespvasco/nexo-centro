ALTER TABLE "model_has_permissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "model_has_roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "permissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_has_permissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "model_has_permissions" CASCADE;--> statement-breakpoint
DROP TABLE "model_has_roles" CASCADE;--> statement-breakpoint
DROP TABLE "permissions" CASCADE;--> statement-breakpoint
DROP TABLE "role_has_permissions" CASCADE;--> statement-breakpoint
DROP TABLE "roles" CASCADE;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "hospital_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_users_hospital_id_idx" ON "admin_users" USING btree ("hospital_id");--> statement-breakpoint
ALTER TABLE "hospital_user" DROP COLUMN "papel";--> statement-breakpoint
DROP TYPE "public"."hospital_role";