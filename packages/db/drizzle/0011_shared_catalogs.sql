CREATE TABLE "especialidade_hospital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"especialidade_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "funcao_cirurgiao_hospital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funcao_cirurgiao_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "procedimento_hospital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"procedimento_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tipo_de_abordagem_hospital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo_de_abordagem_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tipo_de_cirurgia_hospital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo_de_cirurgia_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "zona_anatomica_hospital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zona_anatomica_id" uuid NOT NULL,
	"hospital_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "especialidades" DROP CONSTRAINT "especialidades_hospital_id_hospitals_id_fk";
--> statement-breakpoint
ALTER TABLE "funcao_cirurgiaos" DROP CONSTRAINT "funcao_cirurgiaos_hospital_id_hospitals_id_fk";
--> statement-breakpoint
ALTER TABLE "procedimentos" DROP CONSTRAINT "procedimentos_hospital_id_hospitals_id_fk";
--> statement-breakpoint
ALTER TABLE "tipo_de_abordagens" DROP CONSTRAINT "tipo_de_abordagens_hospital_id_hospitals_id_fk";
--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgias" DROP CONSTRAINT "tipo_de_cirurgias_hospital_id_hospitals_id_fk";
--> statement-breakpoint
ALTER TABLE "zona_anatomicas" DROP CONSTRAINT "zona_anatomicas_hospital_id_hospitals_id_fk";
--> statement-breakpoint
DROP INDEX "especialidades_hospital_id_nome_uq";--> statement-breakpoint
DROP INDEX "especialidades_hospital_id_idx";--> statement-breakpoint
DROP INDEX "funcao_cirurgiaos_hospital_id_nome_uq";--> statement-breakpoint
DROP INDEX "funcao_cirurgiaos_hospital_id_idx";--> statement-breakpoint
DROP INDEX "procedimentos_hospital_id_nome_uq";--> statement-breakpoint
DROP INDEX "procedimentos_hospital_id_idx";--> statement-breakpoint
DROP INDEX "tipo_de_abordagens_hospital_id_nome_uq";--> statement-breakpoint
DROP INDEX "tipo_de_abordagens_hospital_id_idx";--> statement-breakpoint
DROP INDEX "tipo_de_cirurgias_hospital_id_nome_uq";--> statement-breakpoint
DROP INDEX "tipo_de_cirurgias_hospital_id_idx";--> statement-breakpoint
DROP INDEX "zona_anatomicas_hospital_id_nome_uq";--> statement-breakpoint
DROP INDEX "zona_anatomicas_hospital_id_idx";--> statement-breakpoint
DROP INDEX "especialidades_nome_global_uq";--> statement-breakpoint
DROP INDEX "funcao_cirurgiaos_nome_global_uq";--> statement-breakpoint
DROP INDEX "procedimentos_nome_global_uq";--> statement-breakpoint
DROP INDEX "tipo_de_abordagens_nome_global_uq";--> statement-breakpoint
DROP INDEX "tipo_de_cirurgias_nome_global_uq";--> statement-breakpoint
DROP INDEX "zona_anatomicas_nome_global_uq";--> statement-breakpoint
ALTER TABLE "especialidades" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "especialidades" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "funcao_cirurgiaos" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "funcao_cirurgiaos" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "procedimentos" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "procedimentos" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tipo_de_abordagens" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tipo_de_abordagens" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgias" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgias" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "zona_anatomicas" ADD COLUMN "is_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zona_anatomicas" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "especialidade_hospital" ADD CONSTRAINT "especialidade_hospital_especialidade_id_especialidades_id_fk" FOREIGN KEY ("especialidade_id") REFERENCES "public"."especialidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialidade_hospital" ADD CONSTRAINT "especialidade_hospital_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialidade_hospital" ADD CONSTRAINT "especialidade_hospital_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcao_cirurgiao_hospital" ADD CONSTRAINT "funcao_cirurgiao_hospital_funcao_cirurgiao_id_funcao_cirurgiaos_id_fk" FOREIGN KEY ("funcao_cirurgiao_id") REFERENCES "public"."funcao_cirurgiaos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcao_cirurgiao_hospital" ADD CONSTRAINT "funcao_cirurgiao_hospital_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcao_cirurgiao_hospital" ADD CONSTRAINT "funcao_cirurgiao_hospital_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimento_hospital" ADD CONSTRAINT "procedimento_hospital_procedimento_id_procedimentos_id_fk" FOREIGN KEY ("procedimento_id") REFERENCES "public"."procedimentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimento_hospital" ADD CONSTRAINT "procedimento_hospital_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimento_hospital" ADD CONSTRAINT "procedimento_hospital_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_abordagem_hospital" ADD CONSTRAINT "tipo_de_abordagem_hospital_tipo_de_abordagem_id_tipo_de_abordagens_id_fk" FOREIGN KEY ("tipo_de_abordagem_id") REFERENCES "public"."tipo_de_abordagens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_abordagem_hospital" ADD CONSTRAINT "tipo_de_abordagem_hospital_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_abordagem_hospital" ADD CONSTRAINT "tipo_de_abordagem_hospital_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgia_hospital" ADD CONSTRAINT "tipo_de_cirurgia_hospital_tipo_de_cirurgia_id_tipo_de_cirurgias_id_fk" FOREIGN KEY ("tipo_de_cirurgia_id") REFERENCES "public"."tipo_de_cirurgias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgia_hospital" ADD CONSTRAINT "tipo_de_cirurgia_hospital_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgia_hospital" ADD CONSTRAINT "tipo_de_cirurgia_hospital_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zona_anatomica_hospital" ADD CONSTRAINT "zona_anatomica_hospital_zona_anatomica_id_zona_anatomicas_id_fk" FOREIGN KEY ("zona_anatomica_id") REFERENCES "public"."zona_anatomicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zona_anatomica_hospital" ADD CONSTRAINT "zona_anatomica_hospital_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zona_anatomica_hospital" ADD CONSTRAINT "zona_anatomica_hospital_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "especialidade_hospital_item_hospital_uq" ON "especialidade_hospital" USING btree ("especialidade_id","hospital_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "especialidade_hospital_hospital_id_idx" ON "especialidade_hospital" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "especialidade_hospital_item_idx" ON "especialidade_hospital" USING btree ("especialidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "funcao_cirurgiao_hospital_item_hospital_uq" ON "funcao_cirurgiao_hospital" USING btree ("funcao_cirurgiao_id","hospital_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "funcao_cirurgiao_hospital_hospital_id_idx" ON "funcao_cirurgiao_hospital" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "funcao_cirurgiao_hospital_item_idx" ON "funcao_cirurgiao_hospital" USING btree ("funcao_cirurgiao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "procedimento_hospital_item_hospital_uq" ON "procedimento_hospital" USING btree ("procedimento_id","hospital_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "procedimento_hospital_hospital_id_idx" ON "procedimento_hospital" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "procedimento_hospital_item_idx" ON "procedimento_hospital" USING btree ("procedimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_abordagem_hospital_item_hospital_uq" ON "tipo_de_abordagem_hospital" USING btree ("tipo_de_abordagem_id","hospital_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tipo_de_abordagem_hospital_hospital_id_idx" ON "tipo_de_abordagem_hospital" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "tipo_de_abordagem_hospital_item_idx" ON "tipo_de_abordagem_hospital" USING btree ("tipo_de_abordagem_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_cirurgia_hospital_item_hospital_uq" ON "tipo_de_cirurgia_hospital" USING btree ("tipo_de_cirurgia_id","hospital_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tipo_de_cirurgia_hospital_hospital_id_idx" ON "tipo_de_cirurgia_hospital" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "tipo_de_cirurgia_hospital_item_idx" ON "tipo_de_cirurgia_hospital" USING btree ("tipo_de_cirurgia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zona_anatomica_hospital_item_hospital_uq" ON "zona_anatomica_hospital" USING btree ("zona_anatomica_id","hospital_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "zona_anatomica_hospital_hospital_id_idx" ON "zona_anatomica_hospital" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "zona_anatomica_hospital_item_idx" ON "zona_anatomica_hospital" USING btree ("zona_anatomica_id");--> statement-breakpoint
ALTER TABLE "especialidades" ADD CONSTRAINT "especialidades_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcao_cirurgiaos" ADD CONSTRAINT "funcao_cirurgiaos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimentos" ADD CONSTRAINT "procedimentos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_abordagens" ADD CONSTRAINT "tipo_de_abordagens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgias" ADD CONSTRAINT "tipo_de_cirurgias_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zona_anatomicas" ADD CONSTRAINT "zona_anatomicas_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "especialidades_created_by_user_id_idx" ON "especialidades" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "funcao_cirurgiaos_created_by_user_id_idx" ON "funcao_cirurgiaos" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "procedimentos_created_by_user_id_idx" ON "procedimentos" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "tipo_de_abordagens_created_by_user_id_idx" ON "tipo_de_abordagens" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "tipo_de_cirurgias_created_by_user_id_idx" ON "tipo_de_cirurgias" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "zona_anatomicas_created_by_user_id_idx" ON "zona_anatomicas" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "especialidades_nome_global_uq" ON "especialidades" USING btree ("nome") WHERE deleted_at is null and is_global;--> statement-breakpoint
CREATE UNIQUE INDEX "funcao_cirurgiaos_nome_global_uq" ON "funcao_cirurgiaos" USING btree ("nome") WHERE deleted_at is null and is_global;--> statement-breakpoint
CREATE UNIQUE INDEX "procedimentos_nome_global_uq" ON "procedimentos" USING btree ("nome") WHERE deleted_at is null and is_global;--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_abordagens_nome_global_uq" ON "tipo_de_abordagens" USING btree ("nome") WHERE deleted_at is null and is_global;--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_cirurgias_nome_global_uq" ON "tipo_de_cirurgias" USING btree ("nome") WHERE deleted_at is null and is_global;--> statement-breakpoint
CREATE UNIQUE INDEX "zona_anatomicas_nome_global_uq" ON "zona_anatomicas" USING btree ("nome") WHERE deleted_at is null and is_global;--> statement-breakpoint
-- Data migration: mover o âmbito hospitalar dos seis catálogos partilháveis para
-- as tabelas de associação ANTES de remover a coluna hospital_id. Cada item com
-- hospital_id passa a ter uma associação a esse hospital; os itens sem hospital_id
-- (antes "globais") passam a is_global = true. Só se migram itens vivos
-- (deleted_at is null) para não criar associações ativas de itens eliminados.
INSERT INTO "especialidade_hospital" ("especialidade_id", "hospital_id") SELECT "id", "hospital_id" FROM "especialidades" WHERE "hospital_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "especialidades" SET "is_global" = true WHERE "hospital_id" IS NULL;--> statement-breakpoint
INSERT INTO "funcao_cirurgiao_hospital" ("funcao_cirurgiao_id", "hospital_id") SELECT "id", "hospital_id" FROM "funcao_cirurgiaos" WHERE "hospital_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "funcao_cirurgiaos" SET "is_global" = true WHERE "hospital_id" IS NULL;--> statement-breakpoint
INSERT INTO "procedimento_hospital" ("procedimento_id", "hospital_id") SELECT "id", "hospital_id" FROM "procedimentos" WHERE "hospital_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "procedimentos" SET "is_global" = true WHERE "hospital_id" IS NULL;--> statement-breakpoint
INSERT INTO "tipo_de_abordagem_hospital" ("tipo_de_abordagem_id", "hospital_id") SELECT "id", "hospital_id" FROM "tipo_de_abordagens" WHERE "hospital_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "tipo_de_abordagens" SET "is_global" = true WHERE "hospital_id" IS NULL;--> statement-breakpoint
INSERT INTO "tipo_de_cirurgia_hospital" ("tipo_de_cirurgia_id", "hospital_id") SELECT "id", "hospital_id" FROM "tipo_de_cirurgias" WHERE "hospital_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "tipo_de_cirurgias" SET "is_global" = true WHERE "hospital_id" IS NULL;--> statement-breakpoint
INSERT INTO "zona_anatomica_hospital" ("zona_anatomica_id", "hospital_id", "ordem") SELECT "id", "hospital_id", "ordem" FROM "zona_anatomicas" WHERE "hospital_id" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "zona_anatomicas" SET "is_global" = true WHERE "hospital_id" IS NULL;--> statement-breakpoint
ALTER TABLE "especialidades" DROP COLUMN "hospital_id";--> statement-breakpoint
ALTER TABLE "funcao_cirurgiaos" DROP COLUMN "hospital_id";--> statement-breakpoint
ALTER TABLE "procedimentos" DROP COLUMN "hospital_id";--> statement-breakpoint
ALTER TABLE "tipo_de_abordagens" DROP COLUMN "hospital_id";--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgias" DROP COLUMN "hospital_id";--> statement-breakpoint
ALTER TABLE "zona_anatomicas" DROP COLUMN "hospital_id";