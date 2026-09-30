import { z } from "zod";
import { tipoLesaoSchema } from "./diagnostico.js";

export const clavienDindoSchema = z.enum([
  "sem_complicacoes",
  "I",
  "II",
  "IIIa",
  "IIIb",
  "IVa",
  "IVb",
  "V",
]);

/** Linha de cirurgia dentro de um registo (uma intervenção sobre um diagnóstico). */
export const cirurgiaSchema = z.object({
  id: z.uuid(),
  diagnosticoId: z.uuid(),
  procedimentoId: z.uuid(),
  tipo: tipoLesaoSchema.nullable(),
  funcaoCirurgiaoId: z.uuid().nullable(),
  clavienDindo: clavienDindoSchema.nullable(),
  anatomiaPatologica: z.string().nullable(),
  observacoes: z.string().nullable(),
});

export const createCirurgiaSchema = z.object({
  diagnosticoId: z.uuid(),
  procedimentoId: z.uuid(),
  tipo: tipoLesaoSchema.nullable(),
  funcaoCirurgiaoId: z.uuid().nullable(),
  clavienDindo: clavienDindoSchema.nullable(),
  anatomiaPatologica: z.string().trim().max(5000).nullable(),
  observacoes: z.string().trim().max(5000).nullable(),
});

/** Payload de criação de um registo cirúrgico com as suas cirurgias (>= 1). */
export const createRegistoSchema = z.object({
  utenteId: z.uuid(),
  especialidadeId: z.uuid().nullable(),
  dataCirurgia: z.iso.date(),
  idadeCirurgia: z.number().int().min(0).max(150).nullable(),
  tipoDeCirurgiaId: z.uuid(),
  tipoDeAbordagemId: z.uuid().nullable(),
  ambulatorio: z.boolean().default(false),
  observacoes: z.string().trim().max(5000).nullable(),
  cirurgias: z
    .array(createCirurgiaSchema)
    .min(1, "Adicione pelo menos uma cirurgia.")
    .max(50, "Um registo não pode ter mais de 50 cirurgias."),
});

export const updateRegistoSchema = createRegistoSchema;

/** Linha de resumo para a listagem de registos (sem as cirurgias, só a contagem). */
export const registoResumoSchema = z.object({
  id: z.uuid(),
  utenteNome: z.string().nullable(),
  utenteProcesso: z.string(),
  especialidadeNome: z.string().nullable(),
  dataCirurgia: z.iso.date(),
  tipoDeCirurgiaNome: z.string().nullable(),
  tipoDeAbordagemNome: z.string().nullable(),
  ambulatorio: z.boolean(),
  numeroCirurgias: z.number().int(),
});

/** Cirurgia enriquecida com os nomes das referências, para leitura no detalhe. */
export const cirurgiaDetalheSchema = cirurgiaSchema.extend({
  diagnosticoNome: z.string().nullable(),
  procedimentoNome: z.string().nullable(),
  funcaoCirurgiaoNome: z.string().nullable(),
});

/** Registo enriquecido para a listagem/detalhe. */
export const registoDetalheSchema = z.object({
  id: z.uuid(),
  hospitalId: z.uuid(),
  userId: z.uuid().nullable(),
  utenteId: z.uuid(),
  utenteNome: z.string().nullable(),
  utenteProcesso: z.string(),
  especialidadeId: z.uuid().nullable(),
  especialidadeNome: z.string().nullable(),
  dataCirurgia: z.iso.date(),
  idadeCirurgia: z.number().int().nullable(),
  tipoDeCirurgiaId: z.uuid(),
  tipoDeCirurgiaNome: z.string().nullable(),
  tipoDeAbordagemId: z.uuid().nullable(),
  tipoDeAbordagemNome: z.string().nullable(),
  ambulatorio: z.boolean(),
  observacoes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  cirurgias: z.array(cirurgiaDetalheSchema),
});

export const registoFiltrosSchema = z.object({
  search: z.string().optional(),
  dataInicio: z.iso.date().optional(),
  dataFim: z.iso.date().optional(),
  diagnosticoId: z.uuid().optional(),
  procedimentoId: z.uuid().optional(),
  funcaoCirurgiaoId: z.uuid().optional(),
  tipoDeCirurgiaIds: z.array(z.uuid()).optional(),
});

export type ClavienDindo = z.infer<typeof clavienDindoSchema>;
export type Cirurgia = z.infer<typeof cirurgiaSchema>;
export type CreateCirurgia = z.infer<typeof createCirurgiaSchema>;
export type CreateRegisto = z.infer<typeof createRegistoSchema>;
export type UpdateRegisto = z.infer<typeof updateRegistoSchema>;
export type CirurgiaDetalhe = z.infer<typeof cirurgiaDetalheSchema>;
export type RegistoDetalhe = z.infer<typeof registoDetalheSchema>;
export type RegistoResumo = z.infer<typeof registoResumoSchema>;
export type RegistoFiltros = z.infer<typeof registoFiltrosSchema>;
