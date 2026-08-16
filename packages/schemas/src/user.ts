import { z } from 'zod';

/** Shape of a persisted user, mirroring the `users` table in @nexo-centro/db. */
export const userSchema = z.object({
  id: z.uuid(),
  email: z.email().max(255),
  name: z.string().max(255).nullable(),
  createdAt: z.date(),
});

/** Payload accepted when creating a user. */
export const createUserSchema = z.object({
  email: z.email().max(255),
  name: z.string().min(1).max(255).optional(),
});

/** Payload accepted when updating a user. */
export const updateUserSchema = createUserSchema.partial();

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
