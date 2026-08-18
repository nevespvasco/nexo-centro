import { z } from 'zod';

export const updateProfileSchema = z.object({
  nome: z.string().trim().min(1).max(255).nullable(),
  email: z.email().max(255),
  especialidadeId: z.uuid().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(255),
  newPassword: z.string().min(8).max(255),
});

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;
