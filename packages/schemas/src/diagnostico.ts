import { z } from 'zod';

export const tipoLesaoSchema = z.enum(['benigno', 'maligno']);

/** Shape of a persisted diagnóstico, mirroring the `diagnosticos` table in @nexo-centro/db. */
export const diagnosticoSchema = z.object({
  id: z.uuid(),
  nome: z.string().max(255),
  zonaAnatomicaId: z.uuid().nullable(),
  tipo: tipoLesaoSchema.nullable(),
  descricao: z.string().nullable(),
  hospitalId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/** Payload accepted when creating a diagnóstico. */
export const createDiagnosticoSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  zonaAnatomicaId: z.uuid(),
  tipo: tipoLesaoSchema,
  descricao: z.string().trim().nullable().optional(),
});

/** Payload accepted when updating a diagnóstico. */
export const updateDiagnosticoSchema = createDiagnosticoSchema.partial();

export type TipoLesao = z.infer<typeof tipoLesaoSchema>;
export type Diagnostico = z.infer<typeof diagnosticoSchema>;
export type CreateDiagnostico = z.infer<typeof createDiagnosticoSchema>;
export type UpdateDiagnostico = z.infer<typeof updateDiagnosticoSchema>;
