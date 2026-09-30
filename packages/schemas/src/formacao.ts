import { z } from "zod";

export const tipoParticipacaoSchema = z.enum([
  "participante",
  "orador",
  "organizador",
  "moderador",
]);

export const tipoFormacaoSchema = z.enum([
  "curso",
  "congresso",
  "pos_graduacao",
  "mestrado",
  "doutoramento",
  "outro",
]);

/** Shape of a persisted formação, mirroring the `formacoes` table. */
export const formacaoSchema = z.object({
  id: z.uuid(),
  titulo: z.string().max(255),
  tipo: tipoFormacaoSchema,
  dataInicio: z.iso.date(),
  dataFim: z.iso.date().nullable(),
  duracaoHoras: z.number().int().nullable(),
  // decimal(8,2) — o Drizzle devolve numeric como string.
  creditos: z.string().nullable(),
  certificadoPath: z.string().nullable(),
  descricao: z.string().nullable(),
  entidadeOrganizadora: z.string().nullable(),
  localizacao: z.string().nullable(),
  categoria: z.string().nullable(),
  tipoParticipacao: tipoParticipacaoSchema.nullable(),
  temaApresentacao: z.string().nullable(),
  observacoes: z.string().nullable(),
  certificadoOriginalName: z.string().nullable(),
  certificadoSize: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Payload accepted when creating a formação. Única validação inter-campos do
 * sistema: `dataFim`, se presente, tem de ser >= `dataInicio` (espelha o CHECK
 * `formacoes_datas_check` da BD, para dar erro amigável antes de chegar ao Postgres).
 */
export const createFormacaoSchema = z
  .object({
    titulo: z.string().trim().min(1).max(255),
    tipo: tipoFormacaoSchema,
    dataInicio: z.iso.date(),
    dataFim: z.iso.date().nullable(),
    duracaoHoras: z.number().int().min(1).max(10000).nullable(),
    creditos: z.number().min(0).max(999999.99).nullable(),
    descricao: z.string().trim().max(2000).nullable().optional(),
    entidadeOrganizadora: z.string().trim().max(255).nullable().optional(),
    localizacao: z.string().trim().max(255).nullable().optional(),
    categoria: z.string().trim().max(50).nullable().optional(),
    tipoParticipacao: tipoParticipacaoSchema.nullable().optional(),
    temaApresentacao: z.string().trim().max(500).nullable().optional(),
    observacoes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.dataFim === null || v.dataFim >= v.dataInicio, {
    message: "A data de fim tem de ser igual ou posterior à data de início.",
    path: ["dataFim"],
  });

/**
 * Update: `.partial()` não é aplicável diretamente a um schema com `.refine()`, por
 * isso repetimos o shape parcial e revalidamos a relação entre datas quando ambas vêm.
 */
export const updateFormacaoSchema = z
  .object({
    titulo: z.string().trim().min(1).max(255).optional(),
    tipo: tipoFormacaoSchema.optional(),
    dataInicio: z.iso.date().optional(),
    dataFim: z.iso.date().nullable().optional(),
    duracaoHoras: z.number().int().min(1).max(10000).nullable().optional(),
    creditos: z.number().min(0).max(999999.99).nullable().optional(),
    descricao: z.string().trim().max(2000).nullable().optional(),
    entidadeOrganizadora: z.string().trim().max(255).nullable().optional(),
    localizacao: z.string().trim().max(255).nullable().optional(),
    categoria: z.string().trim().max(50).nullable().optional(),
    tipoParticipacao: tipoParticipacaoSchema.nullable().optional(),
    temaApresentacao: z.string().trim().max(500).nullable().optional(),
    observacoes: z.string().trim().max(2000).nullable().optional(),
    removerCertificado: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.dataInicio === undefined ||
      v.dataFim == null ||
      v.dataFim >= v.dataInicio,
    {
      message: "A data de fim tem de ser igual ou posterior à data de início.",
      path: ["dataFim"],
    },
  );

export type TipoFormacao = z.infer<typeof tipoFormacaoSchema>;
export type TipoParticipacao = z.infer<typeof tipoParticipacaoSchema>;
export type Formacao = z.infer<typeof formacaoSchema>;
export type CreateFormacao = z.infer<typeof createFormacaoSchema>;
export type UpdateFormacao = z.infer<typeof updateFormacaoSchema>;
