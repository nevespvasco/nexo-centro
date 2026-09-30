import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase().max(255),
  password: z.string().min(1).max(255),
});

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(6).max(64),
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase().max(255),
});

export const strongPasswordSchema = z
  .string()
  .min(12, "A palavra-passe deve ter pelo menos 12 caracteres.")
  .max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    message: "A palavra-passe não pode ultrapassar 72 bytes.",
  });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/i, "Token inválido."),
  password: strongPasswordSchema,
});

export const twoFactorConfirmSchema = z.object({
  code: z.string().trim().min(6).max(64),
});

export type LoginPayload = z.infer<typeof loginSchema>;
export type TwoFactorCodePayload = z.infer<typeof twoFactorCodeSchema>;
export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
export type TwoFactorConfirmPayload = z.infer<typeof twoFactorConfirmSchema>;
