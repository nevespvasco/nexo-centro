import { z } from "zod";
import { sharedCatalogRowBase } from "./catalogo-item.js";

/** Shape of a persisted especialidade, mirroring the `especialidades` table + share scope. */
export const especialidadeSchema = z.object({
  ...sharedCatalogRowBase,
  descricao: z.string().max(255).nullable(),
});

/** Payload accepted when creating an especialidade (into one concrete hospital). */
export const createEspecialidadeSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  descricao: z.string().trim().max(255).nullable(),
  hospitalId: z.uuid(),
});

/** Payload accepted when updating an especialidade's content (not its associations). */
export const updateEspecialidadeSchema = z
  .object({
    nome: z.string().trim().min(1).max(255),
    descricao: z.string().trim().max(255).nullable(),
  })
  .partial();

export type EspecialidadeRow = z.infer<typeof especialidadeSchema>;
export type CreateEspecialidade = z.infer<typeof createEspecialidadeSchema>;
export type UpdateEspecialidade = z.infer<typeof updateEspecialidadeSchema>;
