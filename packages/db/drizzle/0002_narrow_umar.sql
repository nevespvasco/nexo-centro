ALTER TABLE "utentes" ALTER COLUMN "processo" SET DATA TYPE varchar(255);--> statement-breakpoint
CREATE INDEX "atividades_cientificas_user_id_idx" ON "atividades_cientificas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "atividades_cientificas_tipo_idx" ON "atividades_cientificas" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "atividades_cientificas_data_idx" ON "atividades_cientificas" USING btree ("data");