import { z } from "zod";

/** Linha de registo recente mostrada no painel. */
export const dashboardRegistoRecenteSchema = z.object({
  id: z.uuid(),
  hospitalId: z.uuid(),
  hospitalNome: z.string(),
  dataCirurgia: z.iso.date(),
  utenteNome: z.string().nullable(),
  utenteProcesso: z.string(),
  tipoDeCirurgiaNome: z.string().nullable(),
  numeroCirurgias: z.number().int(),
});

/**
 * Métricas do painel clínico, todas do utilizador autenticado no hospital ativo.
 * Ao contrário do sistema legado (ver docs/MedTrack, RN-M8-02/INC-03), NÃO se
 * classifica principal/ajudante por comparação de nomes — essa distinção era
 * intrinsecamente frágil e devolvia sempre resultados errados.
 */
export const dashboardSchema = z.object({
  totalRegistos: z.number().int(),
  totalUtentes: z.number().int(),
  cirurgiasMes: z.number().int(),
  complicacoes: z.number().int(),
  totalAtividades: z.number().int(),
  totalFormacoes: z.number().int(),
  horasFormacao: z.number().int(),
  creditosFormacao: z.number(),
  registosRecentes: z.array(dashboardRegistoRecenteSchema),
});

export type DashboardRegistoRecente = z.infer<
  typeof dashboardRegistoRecenteSchema
>;
export type Dashboard = z.infer<typeof dashboardSchema>;
