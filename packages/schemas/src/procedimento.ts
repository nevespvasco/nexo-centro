import { z } from 'zod';

/** Shape of a persisted procedimento, mirroring the `procedimentos` table in @nexo-centro/db. */
export const procedimentoSchema = z.object({
  id: z.uuid(),
  nome: z.string().max(255),
  especialidadeId: z.uuid().nullable(),
  descricao: z.string().nullable(),
  hospitalId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/** Payload accepted when creating a procedimento. */
export const createProcedimentoSchema = z.object({
  especialidadeId: z.uuid(),
  nome: z.string().trim().min(1).max(255),
});

/** Payload accepted when updating a procedimento. */
export const updateProcedimentoSchema = createProcedimentoSchema.partial();

export type Procedimento = z.infer<typeof procedimentoSchema>;
export type CreateProcedimento = z.infer<typeof createProcedimentoSchema>;
export type UpdateProcedimento = z.infer<typeof updateProcedimentoSchema>;
