CREATE TYPE "public"."clavien_dindo" AS ENUM('sem_complicacoes', 'I', 'II', 'IIIa', 'IIIb', 'IVa', 'IVb', 'V');--> statement-breakpoint
CREATE TYPE "public"."hospital_role" AS ENUM('membro', 'admin');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('pending', 'approved');--> statement-breakpoint
CREATE TYPE "public"."sexo" AS ENUM('masculino', 'feminino', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_atividade" AS ENUM('artigo', 'comunicacao', 'congresso', 'poster', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_formacao" AS ENUM('curso', 'congresso', 'pos_graduacao', 'mestrado', 'doutoramento', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_lesao" AS ENUM('benigno', 'maligno');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255),
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"especialidade_id" uuid,
	"email_verified_at" timestamp with time zone,
	"two_factor_secret" text,
	"two_factor_recovery_codes" text,
	"two_factor_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hospital_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"papel" "hospital_role" DEFAULT 'membro' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "diagnosticos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"zona_anatomica_id" uuid,
	"tipo" "tipo_lesao",
	"descricao" text,
	"hospital_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "especialidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"descricao" varchar(255),
	"hospital_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "funcao_cirurgiaos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"hospital_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "procedimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"especialidade_id" uuid,
	"descricao" text,
	"hospital_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tipo_de_abordagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"hospital_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tipo_de_cirurgias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"hospital_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "zona_anatomicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"descricao" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"hospital_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "utentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255),
	"sexo" "sexo",
	"processo" integer NOT NULL,
	"hospital_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cirurgias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registo_cirurgico_id" uuid NOT NULL,
	"diagnostico_id" uuid NOT NULL,
	"procedimento_id" uuid NOT NULL,
	"tipo" "tipo_lesao",
	"funcao_cirurgiao_id" uuid,
	"clavien_dindo" "clavien_dindo",
	"anatomia_patologica" text,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "registo_cirurgicos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hospital_id" uuid NOT NULL,
	"user_id" uuid,
	"utente_id" uuid NOT NULL,
	"especialidade_id" uuid,
	"data_cirurgia" date NOT NULL,
	"idade_cirurgia" integer,
	"tipo_de_cirurgia_id" uuid NOT NULL,
	"tipo_de_abordagem_id" uuid,
	"ambulatorio" boolean DEFAULT false NOT NULL,
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "atividades_cientificas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"tipo" "tipo_atividade" NOT NULL,
	"data" date NOT NULL,
	"autor_principal" boolean DEFAULT false NOT NULL,
	"posicao_autor" integer,
	"fator_impacto" numeric(8, 3),
	"ficheiro_path" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "formacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"tipo" "tipo_formacao" NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date,
	"duracao_horas" integer,
	"creditos" numeric(8, 2),
	"certificado_path" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "formacoes_datas_check" CHECK (data_fim >= data_inicio)
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "model_has_permissions" (
	"permission_id" uuid NOT NULL,
	"model_type" varchar(255) NOT NULL,
	"model_id" uuid NOT NULL,
	CONSTRAINT "model_has_permissions_pkey" PRIMARY KEY("permission_id","model_id","model_type")
);
--> statement-breakpoint
CREATE TABLE "model_has_roles" (
	"role_id" uuid NOT NULL,
	"model_type" varchar(255) NOT NULL,
	"model_id" uuid NOT NULL,
	CONSTRAINT "model_has_roles_pkey" PRIMARY KEY("role_id","model_id","model_type")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"guard_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_has_permissions" (
	"permission_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "role_has_permissions_pkey" PRIMARY KEY("permission_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"guard_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_especialidade_id_especialidades_id_fk" FOREIGN KEY ("especialidade_id") REFERENCES "public"."especialidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_user" ADD CONSTRAINT "hospital_user_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_user" ADD CONSTRAINT "hospital_user_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_user" ADD CONSTRAINT "hospital_user_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_zona_anatomica_id_zona_anatomicas_id_fk" FOREIGN KEY ("zona_anatomica_id") REFERENCES "public"."zona_anatomicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "especialidades" ADD CONSTRAINT "especialidades_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcao_cirurgiaos" ADD CONSTRAINT "funcao_cirurgiaos_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimentos" ADD CONSTRAINT "procedimentos_especialidade_id_especialidades_id_fk" FOREIGN KEY ("especialidade_id") REFERENCES "public"."especialidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimentos" ADD CONSTRAINT "procedimentos_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_abordagens" ADD CONSTRAINT "tipo_de_abordagens_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_de_cirurgias" ADD CONSTRAINT "tipo_de_cirurgias_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zona_anatomicas" ADD CONSTRAINT "zona_anatomicas_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utentes" ADD CONSTRAINT "utentes_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utentes" ADD CONSTRAINT "utentes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cirurgias" ADD CONSTRAINT "cirurgias_registo_cirurgico_id_registo_cirurgicos_id_fk" FOREIGN KEY ("registo_cirurgico_id") REFERENCES "public"."registo_cirurgicos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cirurgias" ADD CONSTRAINT "cirurgias_diagnostico_id_diagnosticos_id_fk" FOREIGN KEY ("diagnostico_id") REFERENCES "public"."diagnosticos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cirurgias" ADD CONSTRAINT "cirurgias_procedimento_id_procedimentos_id_fk" FOREIGN KEY ("procedimento_id") REFERENCES "public"."procedimentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cirurgias" ADD CONSTRAINT "cirurgias_funcao_cirurgiao_id_funcao_cirurgiaos_id_fk" FOREIGN KEY ("funcao_cirurgiao_id") REFERENCES "public"."funcao_cirurgiaos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registo_cirurgicos" ADD CONSTRAINT "registo_cirurgicos_hospital_id_hospitals_id_fk" FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registo_cirurgicos" ADD CONSTRAINT "registo_cirurgicos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registo_cirurgicos" ADD CONSTRAINT "registo_cirurgicos_utente_id_utentes_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utentes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registo_cirurgicos" ADD CONSTRAINT "registo_cirurgicos_especialidade_id_especialidades_id_fk" FOREIGN KEY ("especialidade_id") REFERENCES "public"."especialidades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registo_cirurgicos" ADD CONSTRAINT "registo_cirurgicos_tipo_de_cirurgia_id_tipo_de_cirurgias_id_fk" FOREIGN KEY ("tipo_de_cirurgia_id") REFERENCES "public"."tipo_de_cirurgias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registo_cirurgicos" ADD CONSTRAINT "registo_cirurgicos_tipo_de_abordagem_id_tipo_de_abordagens_id_fk" FOREIGN KEY ("tipo_de_abordagem_id") REFERENCES "public"."tipo_de_abordagens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD CONSTRAINT "atividades_cientificas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formacoes" ADD CONSTRAINT "formacoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_has_permissions" ADD CONSTRAINT "model_has_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_has_roles" ADD CONSTRAINT "model_has_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_has_permissions" ADD CONSTRAINT "role_has_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_has_permissions" ADD CONSTRAINT "role_has_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "users_especialidade_id_idx" ON "users" USING btree ("especialidade_id");--> statement-breakpoint
CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "hospital_user_hospital_id_user_id_uq" ON "hospital_user" USING btree ("hospital_id","user_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "hospital_user_hospital_id_idx" ON "hospital_user" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "hospital_user_user_id_idx" ON "hospital_user" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hospital_user_status_idx" ON "hospital_user" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hospital_user_hospital_id_status_idx" ON "hospital_user" USING btree ("hospital_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "hospitals_nome_uq" ON "hospitals" USING btree ("nome") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "diagnosticos_hospital_id_nome_uq" ON "diagnosticos" USING btree ("hospital_id","nome") WHERE deleted_at is null and hospital_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "diagnosticos_nome_global_uq" ON "diagnosticos" USING btree ("nome") WHERE deleted_at is null and hospital_id is null;--> statement-breakpoint
CREATE INDEX "diagnosticos_hospital_id_idx" ON "diagnosticos" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "diagnosticos_zona_anatomica_id_idx" ON "diagnosticos" USING btree ("zona_anatomica_id");--> statement-breakpoint
CREATE UNIQUE INDEX "especialidades_hospital_id_nome_uq" ON "especialidades" USING btree ("hospital_id","nome") WHERE deleted_at is null and hospital_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "especialidades_nome_global_uq" ON "especialidades" USING btree ("nome") WHERE deleted_at is null and hospital_id is null;--> statement-breakpoint
CREATE INDEX "especialidades_hospital_id_idx" ON "especialidades" USING btree ("hospital_id");--> statement-breakpoint
CREATE UNIQUE INDEX "funcao_cirurgiaos_hospital_id_nome_uq" ON "funcao_cirurgiaos" USING btree ("hospital_id","nome") WHERE deleted_at is null and hospital_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "funcao_cirurgiaos_nome_global_uq" ON "funcao_cirurgiaos" USING btree ("nome") WHERE deleted_at is null and hospital_id is null;--> statement-breakpoint
CREATE INDEX "funcao_cirurgiaos_hospital_id_idx" ON "funcao_cirurgiaos" USING btree ("hospital_id");--> statement-breakpoint
CREATE UNIQUE INDEX "procedimentos_hospital_id_nome_uq" ON "procedimentos" USING btree ("hospital_id","nome") WHERE deleted_at is null and hospital_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "procedimentos_nome_global_uq" ON "procedimentos" USING btree ("nome") WHERE deleted_at is null and hospital_id is null;--> statement-breakpoint
CREATE INDEX "procedimentos_hospital_id_idx" ON "procedimentos" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "procedimentos_especialidade_id_idx" ON "procedimentos" USING btree ("especialidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_abordagens_hospital_id_nome_uq" ON "tipo_de_abordagens" USING btree ("hospital_id","nome") WHERE deleted_at is null and hospital_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_abordagens_nome_global_uq" ON "tipo_de_abordagens" USING btree ("nome") WHERE deleted_at is null and hospital_id is null;--> statement-breakpoint
CREATE INDEX "tipo_de_abordagens_hospital_id_idx" ON "tipo_de_abordagens" USING btree ("hospital_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_cirurgias_hospital_id_nome_uq" ON "tipo_de_cirurgias" USING btree ("hospital_id","nome") WHERE deleted_at is null and hospital_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_de_cirurgias_nome_global_uq" ON "tipo_de_cirurgias" USING btree ("nome") WHERE deleted_at is null and hospital_id is null;--> statement-breakpoint
CREATE INDEX "tipo_de_cirurgias_hospital_id_idx" ON "tipo_de_cirurgias" USING btree ("hospital_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zona_anatomicas_hospital_id_nome_uq" ON "zona_anatomicas" USING btree ("hospital_id","nome") WHERE deleted_at is null and hospital_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "zona_anatomicas_nome_global_uq" ON "zona_anatomicas" USING btree ("nome") WHERE deleted_at is null and hospital_id is null;--> statement-breakpoint
CREATE INDEX "zona_anatomicas_hospital_id_idx" ON "zona_anatomicas" USING btree ("hospital_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utentes_hospital_id_processo_uq" ON "utentes" USING btree ("hospital_id","processo") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "utentes_hospital_id_idx" ON "utentes" USING btree ("hospital_id");--> statement-breakpoint
CREATE INDEX "cirurgias_registo_cirurgico_id_idx" ON "cirurgias" USING btree ("registo_cirurgico_id");--> statement-breakpoint
CREATE INDEX "registo_cirurgicos_hospital_id_data_cirurgia_idx" ON "registo_cirurgicos" USING btree ("hospital_id","data_cirurgia");--> statement-breakpoint
CREATE INDEX "registo_cirurgicos_user_id_data_cirurgia_idx" ON "registo_cirurgicos" USING btree ("user_id","data_cirurgia");--> statement-breakpoint
CREATE INDEX "formacoes_user_id_idx" ON "formacoes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "formacoes_tipo_idx" ON "formacoes" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "formacoes_data_inicio_idx" ON "formacoes" USING btree ("data_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_uq" ON "admin_users" USING btree ("email") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "model_has_permissions_model_id_idx" ON "model_has_permissions" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "model_has_permissions_model_type_idx" ON "model_has_permissions" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "model_has_roles_model_id_idx" ON "model_has_roles" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "model_has_roles_model_type_idx" ON "model_has_roles" USING btree ("model_type");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_nome_guard_name_uq" ON "permissions" USING btree ("nome","guard_name");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_nome_guard_name_uq" ON "roles" USING btree ("nome","guard_name");