import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.email().trim().toLowerCase().max(255),
  password: z.string().min(1).max(255),
});

export const adminUserListItemSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().nullable(),
  email: z.string(),
  isActive: z.boolean(),
  especialidade: z.string().nullable(),
  createdAt: z.date(),
});

export const adminSetActiveSchema = z.object({ isActive: z.boolean() });

export const adminApproveRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;
export type AdminSetActive = z.infer<typeof adminSetActiveSchema>;
export type AdminApproveRequest = z.infer<typeof adminApproveRequestSchema>;
