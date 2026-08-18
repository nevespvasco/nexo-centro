import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(255),
});

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(6).max(64),
});

export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(255),
});

export const twoFactorConfirmSchema = z.object({
  code: z.string().trim().min(6).max(64),
});

export type LoginPayload = z.infer<typeof loginSchema>;
export type TwoFactorCodePayload = z.infer<typeof twoFactorCodeSchema>;
export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
export type TwoFactorConfirmPayload = z.infer<typeof twoFactorConfirmSchema>;
