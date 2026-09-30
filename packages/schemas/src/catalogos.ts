import { z } from "zod";

/** Item genérico de um catálogo de referência (id + nome), usado nas dropdowns. */
export const catalogoItemSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
});

/**
 * Catálogos de referência necessários ao formulário de registo cirúrgico que
 * não têm página de gestão própria (tipos de cirurgia, funções, abordagens).
 */
export const catalogosRegistoSchema = z.object({
  tiposDeCirurgia: z.array(catalogoItemSchema),
  funcoesCirurgiao: z.array(catalogoItemSchema),
  tiposDeAbordagem: z.array(catalogoItemSchema),
});

export type CatalogoItem = z.infer<typeof catalogoItemSchema>;
export type CatalogosRegisto = z.infer<typeof catalogosRegistoSchema>;
