import type { HospitalMembership } from '@nexo-centro/schemas';

export interface HealthResponse {
  status: 'ok';
  service: string;
}

// Same-origin `/api/...` — Vite's dev proxy and nginx's prod config both
// rewrite this to the medfolio-api service, so no base URL is needed here.
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Reads the hospital selected in the shell switcher (see shell/AppShell.tsx),
// persisted by usePersistentState under this key as a JSON string.
function getActiveHospitalId(): string | null {
  try {
    const raw = localStorage.getItem('medfolio.hospital');
    return raw !== null ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
}

// Sent on every request; only routes behind HospitalScopeGuard read it, so
// it's harmless on the rest (e.g. /auth/me, /hospitals). If the API ever
// stops being same-origin, main.ts's enableCors needs
// allowedHeaders: ['Content-Type', 'X-Hospital-Id'] for the preflight to allow it.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const activeHospitalId = getActiveHospitalId();
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : undefined),
      ...(activeHospitalId ? { 'X-Hospital-Id': activeHospitalId } : undefined),
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? res.statusText, res.status);
  }
  return res.json();
}

const postJson = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

const patchJson = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });

const deleteJson = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export interface AuthUser {
  id: string;
  nome: string | null;
  email: string;
  isActive: boolean;
  especialidadeId: string | null;
  emailVerifiedAt: string | null;
  twoFactorConfirmedAt: string | null;
  twoFactorPromptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type LoginResponse =
  | { status: '2fa_required' }
  | { status: 'ok'; user: AuthUser; mustSetupTwoFactor: boolean };

export function postLogin(email: string, password: string): Promise<LoginResponse> {
  return postJson('/auth/login', { email, password });
}

export function postLoginTwoFactor(code: string): Promise<LoginResponse> {
  return postJson('/auth/login/2fa', { code });
}

export function getMe(): Promise<AuthUser> {
  return request('/auth/me');
}

export function postLogout(): Promise<void> {
  return postJson('/auth/logout');
}

export function postForgotPassword(email: string): Promise<void> {
  return postJson('/auth/forgot-password', { email });
}

export function postResetPassword(token: string, password: string): Promise<void> {
  return postJson('/auth/reset-password', { token, password });
}

export interface TwoFactorSetupResponse {
  otpauthUrl: string;
  qrDataUrl: string;
}

export function getTwoFactorSetup(): Promise<TwoFactorSetupResponse> {
  return postJson('/auth/2fa/setup');
}

export function postTwoFactorConfirm(code: string): Promise<{ status: 'ok'; recoveryCodes: string[] }> {
  return postJson('/auth/2fa/confirm', { code });
}

export function postTwoFactorSkip(): Promise<void> {
  return postJson('/auth/2fa/skip');
}

export function postTwoFactorDisable(code: string): Promise<void> {
  return postJson('/auth/2fa/disable', { code });
}

export interface Especialidade {
  id: string;
  nome: string;
}

export function getEspecialidades(): Promise<Especialidade[]> {
  return request('/profile/especialidades');
}

export function updateProfile(body: {
  nome: string | null;
  email: string;
  especialidadeId: string | null;
}): Promise<AuthUser> {
  return patchJson('/profile', body);
}

export function changePassword(body: { currentPassword: string; newPassword: string }): Promise<void> {
  return postJson('/profile/change-password', body);
}

export function deleteAccount(): Promise<void> {
  return deleteJson('/profile');
}

export function getHospitals(): Promise<HospitalMembership[]> {
  return request('/hospitals');
}
