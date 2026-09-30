import { z } from "zod";

export const sexoSchema = z.enum(["masculino", "feminino", "outro"]);

/** Shape of a persisted utente, mirroring the `utentes` table in @nexo-centro/db. */
export const utenteSchema = z.object({
  id: z.uuid(),
  nome: z.string().max(255).nullable(),
  sexo: sexoSchema.nullable(),
  dataNascimento: z.iso.date().nullable(),
  processo: z.string().max(255),
  hospitalId: z.uuid(),
  createdByUserId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

/** Payload accepted when creating an utente. */
export const createUtenteSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  processo: z.string().trim().min(1).max(255),
  sexo: sexoSchema.nullable(),
  dataNascimento: z.iso.date().nullable(),
});

/** Payload accepted when updating an utente. */
export const updateUtenteSchema = createUtenteSchema.partial();

export type Sexo = z.infer<typeof sexoSchema>;
export type Utente = z.infer<typeof utenteSchema>;
export type CreateUtente = z.infer<typeof createUtenteSchema>;
export type UpdateUtente = z.infer<typeof updateUtenteSchema>;
