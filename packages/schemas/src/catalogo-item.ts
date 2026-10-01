import { z } from 'zod';

export const createCatalogoItemSchema = z.object({
  nome: z.string().trim().min(1).max(255),
  // Hospital concreto onde o item é criado (a primeira associação). Obrigatório:
  // um item nasce sempre ligado a um hospital.
  hospitalId: z.uuid(),
});

export const updateCatalogoItemSchema = z.object({
  nome: z.string().trim().min(1).max(255),
});

/** Payload para associar/desassociar um item a um hospital. */
export const catalogoAssociacaoSchema = z.object({
  hospitalId: z.uuid(),
});

/** Hospital associado devolvido nas listagens de catálogos partilhados. */
export const catalogoHospitalSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
});

/**
 * Linha base de um catálogo partilhável tal como devolvida ao cliente: o item
 * (id/conteúdo únicos) mais o âmbito de partilha calculado no servidor.
 */
export const sharedCatalogRowBase = {
  id: z.uuid(),
  nome: z.string().max(255),
  isGlobal: z.boolean(),
  createdByUserId: z.uuid().nullable(),
  // Hospitais associados dentro do âmbito pedido (vazio quando o item é global).
  hospitais: z.array(catalogoHospitalSchema),
  // Calculado no servidor: o utilizador atual pode alterar conteúdo/associações.
  editable: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
};

export const catalogoItemRowSchema = z.object({ ...sharedCatalogRowBase });

export type CreateCatalogoItem = z.infer<typeof createCatalogoItemSchema>;
export type UpdateCatalogoItem = z.infer<typeof updateCatalogoItemSchema>;
export type CatalogoAssociacao = z.infer<typeof catalogoAssociacaoSchema>;
export type CatalogoHospital = z.infer<typeof catalogoHospitalSchema>;
export type CatalogoItemRow = z.infer<typeof catalogoItemRowSchema>;
