import { z } from "zod";
import { sharedCatalogRowBase } from "./catalogo-item.js";

/** Shape of a persisted procedimento, mirroring the `procedimentos` table + share scope. */
export const procedimentoSchema = z.object({
  ...sharedCatalogRowBase,
  especialidadeId: z.uuid().nullable(),
  descricao: z.string().nullable(),
});

/** Payload accepted when creating a procedimento (into one concrete hospital). */
export const createProcedimentoSchema = z.object({
  especialidadeId: z.uuid(),
  nome: z.string().trim().min(1).max(255),
  hospitalId: z.uuid(),
});

/** Payload accepted when updating a procedimento's content (not its associations). */
export const updateProcedimentoSchema = z
  .object({
    especialidadeId: z.uuid(),
    nome: z.string().trim().min(1).max(255),
  })
  .partial();

export type Procedimento = z.infer<typeof procedimentoSchema>;
export type CreateProcedimento = z.infer<typeof createProcedimentoSchema>;
export type UpdateProcedimento = z.infer<typeof updateProcedimentoSchema>;
