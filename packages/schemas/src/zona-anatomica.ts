import { z } from "zod";
import { sharedCatalogRowBase } from "./catalogo-item.js";

/** Shape of a persisted zona anatómica, mirroring the `zona_anatomicas` table + share scope. */
export const zonaAnatomicaSchema = z.object({
  ...sharedCatalogRowBase,
  descricao: z.string().nullable(),
  // Ordem no hospital pedido (associação); para itens globais é a ordem por defeito.
  ordem: z.number().int(),
});

/** Payload accepted when creating a zona anatómica (into one concrete hospital). */
export const createZonaAnatomicaSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  descricao: z.string().trim().nullable(),
  hospitalId: z.uuid(),
});

/** Payload accepted when updating a zona anatómica's content (not its associations). */
export const updateZonaAnatomicaSchema = z
  .object({
    nome: z.string().trim().min(1).max(255),
    descricao: z.string().trim().nullable(),
  })
  .partial();

/** Payload accepted when reordering zonas anatómicas within one hospital. */
export const reorderZonasAnatomicasSchema = z.array(
  z.object({ id: z.uuid(), ordem: z.number().int().min(0) }),
);

export type ZonaAnatomica = z.infer<typeof zonaAnatomicaSchema>;
export type CreateZonaAnatomica = z.infer<typeof createZonaAnatomicaSchema>;
export type UpdateZonaAnatomica = z.infer<typeof updateZonaAnatomicaSchema>;
export type ReorderZonasAnatomicas = z.infer<
  typeof reorderZonasAnatomicasSchema
>;
