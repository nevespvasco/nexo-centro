import { z } from 'zod';

export const hospitalIdSchema = z.uuid();

export const hospitalMembershipSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  initials: z.string(),
});

export type HospitalMembership = z.infer<typeof hospitalMembershipSchema>;

export const availableHospitalSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
});

export type AvailableHospital = z.infer<typeof availableHospitalSchema>;

export const requestHospitalAccessSchema = z.object({
  hospitalId: z.uuid(),
});

export type RequestHospitalAccess = z.infer<typeof requestHospitalAccessSchema>;
