import { z } from 'zod';

export const hospitalIdSchema = z.uuid();

export const hospitalMembershipSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  initials: z.string(),
});

export type HospitalMembership = z.infer<typeof hospitalMembershipSchema>;
