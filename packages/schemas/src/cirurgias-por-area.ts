import { z } from "zod";
import { tipoLesaoSchema } from "./diagnostico.js";

/** Uma linha folha: um par (diagnóstico × procedimento) com a sua contagem. */
export const cirurgiasPorAreaLinhaSchema = z.object({
  diagnosticoNome: z.string(),
  procedimentoNome: z.string(),
  total: z.number().int(),
});

/** Agrupamento por classificação da lesão (benigno/maligno) dentro de uma zona. */
export const cirurgiasPorAreaTipoSchema = z.object({
  tipo: tipoLesaoSchema.nullable(),
  linhas: z.array(cirurgiasPorAreaLinhaSchema),
  total: z.number().int(),
});

/** Agrupamento de topo: zona anatómica. */
export const cirurgiasPorAreaZonaSchema = z.object({
  zonaAnatomicaId: z.uuid().nullable(),
  zonaAnatomicaNome: z.string(),
  ordem: z.number().int(),
  grupos: z.array(cirurgiasPorAreaTipoSchema),
  total: z.number().int(),
});

export const cirurgiasPorAreaSchema = z.object({
  zonas: z.array(cirurgiasPorAreaZonaSchema),
  total: z.number().int(),
});

export type CirurgiasPorAreaLinha = z.infer<typeof cirurgiasPorAreaLinhaSchema>;
export type CirurgiasPorAreaTipo = z.infer<typeof cirurgiasPorAreaTipoSchema>;
export type CirurgiasPorAreaZona = z.infer<typeof cirurgiasPorAreaZonaSchema>;
export type CirurgiasPorArea = z.infer<typeof cirurgiasPorAreaSchema>;
