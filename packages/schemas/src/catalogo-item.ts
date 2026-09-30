import { z } from 'zod';

export const createCatalogoItemSchema = z.object({
  nome: z.string().trim().min(1).max(255),
});

export const updateCatalogoItemSchema = createCatalogoItemSchema.partial();

export type CreateCatalogoItem = z.infer<typeof createCatalogoItemSchema>;
export type UpdateCatalogoItem = z.infer<typeof updateCatalogoItemSchema>;
