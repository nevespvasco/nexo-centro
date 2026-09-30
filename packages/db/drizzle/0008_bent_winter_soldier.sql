CREATE TYPE "public"."tipo_participacao" AS ENUM('participante', 'orador', 'organizador', 'moderador');--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "descricao" text;--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "revista_conferencia" varchar(255);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "localizacao" varchar(255);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "categoria" varchar(50);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "autores" varchar(1000);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "doi" varchar(255);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "isbn" varchar(50);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "link" varchar(500);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "ficheiro_original_name" varchar(255);--> statement-breakpoint
ALTER TABLE "atividades_cientificas" ADD COLUMN "ficheiro_size" integer;--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "descricao" text;--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "entidade_organizadora" varchar(255);--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "localizacao" varchar(255);--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "categoria" varchar(50);--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "tipo_participacao" "tipo_participacao";--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "tema_apresentacao" varchar(500);--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "certificado_original_name" varchar(255);--> statement-breakpoint
ALTER TABLE "formacoes" ADD COLUMN "certificado_size" integer;