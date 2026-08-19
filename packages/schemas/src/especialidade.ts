import { z } from 'zod';

/** Shape of a persisted especialidade, mirroring the `especialidades` table in @nexo-centro/db. */
export const especialidadeSchema = z.object({
  id: z.uuid(),
  nome: z.string().max(255),
  descricao: z.string().max(255).nullable(),
  hospitalId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/** Payload accepted when creating an especialidade. */
export const createEspecialidadeSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  descricao: z.string().trim().max(255).nullable(),
});

/** Payload accepted when updating an especialidade. */
export const updateEspecialidadeSchema = createEspecialidadeSchema.partial();

export type EspecialidadeRow = z.infer<typeof especialidadeSchema>;
export type CreateEspecialidade = z.infer<typeof createEspecialidadeSchema>;
export type UpdateEspecialidade = z.infer<typeof updateEspecialidadeSchema>;
