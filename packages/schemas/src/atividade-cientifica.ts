import { z } from "zod";

export const tipoAtividadeSchema = z.enum([
  "artigo",
  "comunicacao",
  "congresso",
  "poster",
  "outro",
]);

/** Shape of a persisted atividade científica, mirroring the `atividades_cientificas` table. */
export const atividadeCientificaSchema = z.object({
  id: z.uuid(),
  titulo: z.string().max(255),
  tipo: tipoAtividadeSchema,
  data: z.iso.date(),
  autorPrincipal: z.boolean(),
  posicaoAutor: z.number().int().nullable(),
  // decimal(8,3) — o Drizzle devolve numeric como string.
  fatorImpacto: z.string().nullable(),
  ficheiroPath: z.string().nullable(),
  descricao: z.string().nullable(),
  revistaConferencia: z.string().nullable(),
  localizacao: z.string().nullable(),
  categoria: z.string().nullable(),
  autores: z.string().nullable(),
  doi: z.string().nullable(),
  isbn: z.string().nullable(),
  link: z.string().nullable(),
  observacoes: z.string().nullable(),
  ficheiroOriginalName: z.string().nullable(),
  ficheiroSize: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Payload accepted when creating an atividade científica. */
export const createAtividadeCientificaSchema = z.object({
  titulo: z.string().trim().min(1).max(255),
  tipo: tipoAtividadeSchema,
  data: z.iso.date(),
  autorPrincipal: z.boolean().default(false),
  posicaoAutor: z.number().int().min(1).max(100).nullable(),
  fatorImpacto: z.number().min(0).max(99999.999).nullable(),
  descricao: z.string().trim().max(2000).nullable().optional(),
  revistaConferencia: z.string().trim().max(255).nullable().optional(),
  localizacao: z.string().trim().max(255).nullable().optional(),
  categoria: z.string().trim().max(50).nullable().optional(),
  autores: z.string().trim().max(1000).nullable().optional(),
  doi: z.string().trim().max(255).nullable().optional(),
  isbn: z.string().trim().max(50).nullable().optional(),
  link: z.string().url().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

/** Payload accepted when updating an atividade científica. */
export const updateAtividadeCientificaSchema =
  createAtividadeCientificaSchema.partial().extend({ removerFicheiro: z.boolean().optional() });

export type TipoAtividade = z.infer<typeof tipoAtividadeSchema>;
export type AtividadeCientifica = z.infer<typeof atividadeCientificaSchema>;
export type CreateAtividadeCientifica = z.infer<
  typeof createAtividadeCientificaSchema
>;
export type UpdateAtividadeCientifica = z.infer<
  typeof updateAtividadeCientificaSchema
>;
