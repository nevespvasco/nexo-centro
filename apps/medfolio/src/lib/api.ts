import type { AvailableHospital, HospitalMembership, Sexo, TipoLesao } from '@nexo-centro/schemas';

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
  // DELETE endpoints (and any other void-returning route) send an empty body,
  // which res.json() can't parse — read as text first and only parse if non-empty.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
  hasHospitalMembership: boolean;
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

export function getAvailableHospitals(): Promise<AvailableHospital[]> {
  return request('/hospitals/available');
}

export function requestHospitalAccess(hospitalId: string): Promise<void> {
  return postJson('/hospitals/requests', { hospitalId });
}

// ── Utentes ──────────────────────────────────────────────────────────────

export interface Utente {
  id: string;
  nome: string | null;
  sexo: Sexo | null;
  dataNascimento: string | null;
  processo: string;
  hospitalId: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UtenteBody {
  nome: string;
  processo: string;
  sexo: Sexo | null;
  dataNascimento: string | null;
}

export function getUtentes(): Promise<Utente[]> {
  return request('/utentes');
}

export function getUtente(id: string): Promise<Utente> {
  return request(`/utentes/${id}`);
}

export function createUtente(body: UtenteBody): Promise<Utente> {
  return postJson('/utentes', body);
}

export function updateUtente(id: string, body: Partial<UtenteBody>): Promise<Utente> {
  return patchJson(`/utentes/${id}`, body);
}

export function deleteUtente(id: string): Promise<void> {
  return deleteJson(`/utentes/${id}`);
}

// ── Especialidades (gestão de dados) ────────────────────────────────────
// Distinto de `getEspecialidades`/`Especialidade` acima: aquele serve o dropdown
// de perfil (todas as especialidades, sem scope de hospital); este serve a
// página de gestão de dados (scoped ao hospital ativo + globais).

export interface EspecialidadeRow {
  id: string;
  nome: string;
  descricao: string | null;
  hospitalId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EspecialidadeBody {
  nome: string;
  descricao: string | null;
}

export function listEspecialidades(): Promise<EspecialidadeRow[]> {
  return request('/especialidades');
}

export function getEspecialidade(id: string): Promise<EspecialidadeRow> {
  return request(`/especialidades/${id}`);
}

export function createEspecialidade(body: EspecialidadeBody): Promise<EspecialidadeRow> {
  return postJson('/especialidades', body);
}

export function updateEspecialidade(id: string, body: Partial<EspecialidadeBody>): Promise<EspecialidadeRow> {
  return patchJson(`/especialidades/${id}`, body);
}

export function deleteEspecialidade(id: string): Promise<void> {
  return deleteJson(`/especialidades/${id}`);
}

// ── Zonas anatómicas ─────────────────────────────────────────────────────

export interface ZonaAnatomica {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  hospitalId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ZonaAnatomicaBody {
  nome: string;
  descricao: string | null;
}

export function getZonasAnatomicas(): Promise<ZonaAnatomica[]> {
  return request('/zonas-anatomicas');
}

export function getZonaAnatomica(id: string): Promise<ZonaAnatomica> {
  return request(`/zonas-anatomicas/${id}`);
}

export function createZonaAnatomica(body: ZonaAnatomicaBody): Promise<ZonaAnatomica> {
  return postJson('/zonas-anatomicas', body);
}

export function updateZonaAnatomica(id: string, body: Partial<ZonaAnatomicaBody>): Promise<ZonaAnatomica> {
  return patchJson(`/zonas-anatomicas/${id}`, body);
}

export function deleteZonaAnatomica(id: string): Promise<void> {
  return deleteJson(`/zonas-anatomicas/${id}`);
}

// ── Diagnósticos ─────────────────────────────────────────────────────────

export interface Diagnostico {
  id: string;
  nome: string;
  zonaAnatomicaId: string | null;
  zonaAnatomicaNome: string | null;
  tipo: TipoLesao | null;
  descricao: string | null;
  hospitalId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DiagnosticoBody {
  nome: string;
  zonaAnatomicaId: string;
  tipo: TipoLesao;
  descricao?: string | null;
}

export function getDiagnosticos(): Promise<Diagnostico[]> {
  return request('/diagnosticos');
}

export function getDiagnostico(id: string): Promise<Diagnostico> {
  return request(`/diagnosticos/${id}`);
}

export function createDiagnostico(body: DiagnosticoBody): Promise<Diagnostico> {
  return postJson('/diagnosticos', body);
}

export function updateDiagnostico(id: string, body: Partial<DiagnosticoBody>): Promise<Diagnostico> {
  return patchJson(`/diagnosticos/${id}`, body);
}

export function deleteDiagnostico(id: string): Promise<void> {
  return deleteJson(`/diagnosticos/${id}`);
}

// ── Procedimentos ────────────────────────────────────────────────────────

export interface Procedimento {
  id: string;
  nome: string;
  especialidadeId: string | null;
  especialidadeNome: string | null;
  descricao: string | null;
  hospitalId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProcedimentoBody {
  especialidadeId: string;
  nome: string;
}

export function getProcedimentos(): Promise<Procedimento[]> {
  return request('/procedimentos');
}

export function getProcedimento(id: string): Promise<Procedimento> {
  return request(`/procedimentos/${id}`);
}

export function createProcedimento(body: ProcedimentoBody): Promise<Procedimento> {
  return postJson('/procedimentos', body);
}

export function updateProcedimento(id: string, body: Partial<ProcedimentoBody>): Promise<Procedimento> {
  return patchJson(`/procedimentos/${id}`, body);
}

export function deleteProcedimento(id: string): Promise<void> {
  return deleteJson(`/procedimentos/${id}`);
}
