import { z } from 'zod';

/** Shape of a persisted zona anatómica, mirroring the `zona_anatomicas` table in @nexo-centro/db. */
export const zonaAnatomicaSchema = z.object({
  id: z.uuid(),
  nome: z.string().max(255),
  descricao: z.string().nullable(),
  ordem: z.number().int(),
  hospitalId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/** Payload accepted when creating a zona anatómica. */
export const createZonaAnatomicaSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  descricao: z.string().trim().nullable(),
});

/** Payload accepted when updating a zona anatómica. */
export const updateZonaAnatomicaSchema = createZonaAnatomicaSchema.partial();

export type ZonaAnatomica = z.infer<typeof zonaAnatomicaSchema>;
export type CreateZonaAnatomica = z.infer<typeof createZonaAnatomicaSchema>;
export type UpdateZonaAnatomica = z.infer<typeof updateZonaAnatomicaSchema>;
