ALTER TABLE "admin_users" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "two_factor_recovery_codes" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "two_factor_confirmed_at" timestamp with time zone;