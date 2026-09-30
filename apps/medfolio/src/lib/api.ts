import type {
  AvailableHospital,
  CatalogosRegisto,
  CirurgiasPorArea,
  CreateAtividadeCientifica,
  CreateFormacao,
  CreateRegisto,
  Dashboard,
  HospitalMembership,
  RegistoDetalhe,
  RegistoResumo,
  Sexo,
  TipoAtividade,
  TipoFormacao,
  TipoLesao,
} from '@nexo-centro/schemas';

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
  const csrfToken = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('medfolio_csrf='))
    ?.slice('medfolio_csrf='.length);
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined),
      ...(activeHospitalId ? { 'X-Hospital-Id': activeHospitalId } : undefined),
      ...(csrfToken ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) } : undefined),
      ...init?.headers,
    },
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

export function requestHospitalAccess(hospitalId: string): Promise<{ status: 'pending' }> {
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

export function getUtenteByProcesso(processo: string): Promise<{ utente: Utente | null }> {
  return request(`/utentes/processo/${encodeURIComponent(processo)}`);
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

export function reorderZonasAnatomicas(items: { id: string; ordem: number }[]): Promise<void> {
  return patchJson('/zonas-anatomicas/reorder', items);
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

// ── Atividade científica (portfólio pessoal) ──────────────────────────────

export interface AtividadeCientifica {
  id: string;
  titulo: string;
  tipo: TipoAtividade;
  data: string;
  autorPrincipal: boolean;
  posicaoAutor: number | null;
  fatorImpacto: string | null;
  ficheiroPath: string | null;
  ficheiroOriginalName: string | null;
  ficheiroSize: number | null;
  descricao: string | null;
  revistaConferencia: string | null;
  localizacao: string | null;
  categoria: string | null;
  autores: string | null;
  doi: string | null;
  isbn: string | null;
  link: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getAtividadesCientificas(): Promise<AtividadeCientifica[]> {
  return request('/atividades-cientificas');
}

export function createAtividadeCientifica(body: CreateAtividadeCientifica, file?: File | null): Promise<AtividadeCientifica> {
  if (file) return request('/atividades-cientificas', { method: 'POST', body: portfolioFormData(body, 'ficheiro', file) });
  return postJson('/atividades-cientificas', body);
}

export function updateAtividadeCientifica(
  id: string,
  body: CreateAtividadeCientifica & { removerFicheiro?: boolean },
  file?: File | null,
): Promise<AtividadeCientifica> {
  if (file) return request(`/atividades-cientificas/${id}`, { method: 'PATCH', body: portfolioFormData(body, 'ficheiro', file) });
  return patchJson(`/atividades-cientificas/${id}`, body);
}

export function downloadAtividade(id: string): Promise<void> {
  return download(`/atividades-cientificas/${id}/download`, 'atividade');
}

export function exportAtividades(): Promise<void> {
  return download('/atividades-cientificas/export', 'atividades.xlsx');
}

export function deleteAtividadeCientifica(id: string): Promise<void> {
  return deleteJson(`/atividades-cientificas/${id}`);
}

// ── Formações (portfólio pessoal) ─────────────────────────────────────────

export interface Formacao {
  id: string;
  titulo: string;
  tipo: TipoFormacao;
  dataInicio: string;
  dataFim: string | null;
  duracaoHoras: number | null;
  creditos: string | null;
  certificadoPath: string | null;
  certificadoOriginalName: string | null;
  certificadoSize: number | null;
  descricao: string | null;
  entidadeOrganizadora: string | null;
  localizacao: string | null;
  categoria: string | null;
  tipoParticipacao: string | null;
  temaApresentacao: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getFormacoes(): Promise<Formacao[]> {
  return request('/formacoes');
}

export function createFormacao(body: CreateFormacao, file?: File | null): Promise<Formacao> {
  if (file) return request('/formacoes', { method: 'POST', body: portfolioFormData(body, 'certificado', file) });
  return postJson('/formacoes', body);
}

export function updateFormacao(id: string, body: CreateFormacao & { removerCertificado?: boolean }, file?: File | null): Promise<Formacao> {
  if (file) return request(`/formacoes/${id}`, { method: 'PATCH', body: portfolioFormData(body, 'certificado', file) });
  return patchJson(`/formacoes/${id}`, body);
}

export function downloadFormacao(id: string): Promise<void> {
  return download(`/formacoes/${id}/download`, 'certificado');
}

export function exportFormacoes(): Promise<void> {
  return download('/formacoes/export', 'formacoes.xlsx');
}

function portfolioFormData(body: unknown, field: string, file: File): FormData {
  const data = new FormData();
  data.append('payload', JSON.stringify(body));
  data.append(field, file);
  return data;
}

async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? response.statusText, response.status);
  }
  const disposition = response.headers.get('Content-Disposition');
  const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  const name = encodedName ? decodeURIComponent(encodedName) : plainName ? decodeURIComponent(plainName) : fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function deleteFormacao(id: string): Promise<void> {
  return deleteJson(`/formacoes/${id}`);
}

// ── Catálogos de referência (dropdowns do registo) ────────────────────────

export function getCatalogosRegisto(): Promise<CatalogosRegisto> {
  return request('/catalogos/registo');
}

// ── Registos cirúrgicos ───────────────────────────────────────────────────

export interface RegistoFiltros {
  search?: string;
  dataInicio?: string;
  dataFim?: string;
  diagnosticoId?: string;
  procedimentoId?: string;
  funcaoCirurgiaoId?: string;
  tipoDeCirurgiaIds?: string[];
}

export function getRegistos(filtros?: RegistoFiltros): Promise<RegistoResumo[]> {
  const params = new URLSearchParams();
  if (filtros?.search) params.set('search', filtros.search);
  if (filtros?.dataInicio) params.set('dataInicio', filtros.dataInicio);
  if (filtros?.dataFim) params.set('dataFim', filtros.dataFim);
  if (filtros?.diagnosticoId) params.set('diagnosticoId', filtros.diagnosticoId);
  if (filtros?.procedimentoId) params.set('procedimentoId', filtros.procedimentoId);
  if (filtros?.funcaoCirurgiaoId) params.set('funcaoCirurgiaoId', filtros.funcaoCirurgiaoId);
  filtros?.tipoDeCirurgiaIds?.forEach((id) => params.append('tipoDeCirurgiaIds', id));
  const qs = params.toString();
  return request(`/registos-cirurgicos${qs ? `?${qs}` : ''}`);
}

export function getRegisto(id: string): Promise<RegistoDetalhe> {
  return request(`/registos-cirurgicos/${id}`);
}

export function createRegisto(body: CreateRegisto): Promise<RegistoDetalhe> {
  return postJson('/registos-cirurgicos', body);
}

export function updateRegisto(id: string, body: CreateRegisto): Promise<RegistoDetalhe> {
  return patchJson(`/registos-cirurgicos/${id}`, body);
}

export function deleteRegisto(id: string): Promise<void> {
  return deleteJson(`/registos-cirurgicos/${id}`);
}

export function exportRegistos(filtros?: RegistoFiltros): Promise<void> {
  const params = new URLSearchParams();
  if (filtros?.search) params.set('search', filtros.search);
  if (filtros?.dataInicio) params.set('dataInicio', filtros.dataInicio);
  if (filtros?.dataFim) params.set('dataFim', filtros.dataFim);
  if (filtros?.diagnosticoId) params.set('diagnosticoId', filtros.diagnosticoId);
  if (filtros?.procedimentoId) params.set('procedimentoId', filtros.procedimentoId);
  if (filtros?.funcaoCirurgiaoId) params.set('funcaoCirurgiaoId', filtros.funcaoCirurgiaoId);
  filtros?.tipoDeCirurgiaIds?.forEach((id) => params.append('tipoDeCirurgiaIds', id));
  const qs = params.toString();
  return download(`/registos-cirurgicos/export${qs ? `?${qs}` : ''}`, 'registos-cirurgicos.xlsx');
}

// ── Catálogos: Tipos de Cirurgia, Funções Cirurgião, Tipos de Abordagem ──────

export interface CatalogoItem {
  id: string;
  nome: string;
  descricao: string | null;
  hospitalId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CatalogoItemBody {
  nome: string;
  descricao: string | null;
}

// Tipos de cirurgia
export function listTiposDeCirurgia(): Promise<CatalogoItem[]> {
  return request('/tipos-de-cirurgia');
}
export function createTipoDeCirurgia(body: CatalogoItemBody): Promise<CatalogoItem> {
  return postJson('/tipos-de-cirurgia', body);
}
export function updateTipoDeCirurgia(id: string, body: Partial<CatalogoItemBody>): Promise<CatalogoItem> {
  return patchJson(`/tipos-de-cirurgia/${id}`, body);
}
export function deleteTipoDeCirurgia(id: string): Promise<void> {
  return deleteJson(`/tipos-de-cirurgia/${id}`);
}

// Funções cirurgião
export function listFuncoesCirurgiao(): Promise<CatalogoItem[]> {
  return request('/funcoes-cirurgiao');
}
export function createFuncaoCirurgiao(body: CatalogoItemBody): Promise<CatalogoItem> {
  return postJson('/funcoes-cirurgiao', body);
}
export function updateFuncaoCirurgiao(id: string, body: Partial<CatalogoItemBody>): Promise<CatalogoItem> {
  return patchJson(`/funcoes-cirurgiao/${id}`, body);
}
export function deleteFuncaoCirurgiao(id: string): Promise<void> {
  return deleteJson(`/funcoes-cirurgiao/${id}`);
}

// Tipos de abordagem
export function listTiposDeAbordagem(): Promise<CatalogoItem[]> {
  return request('/tipos-de-abordagem');
}
export function createTipoDeAbordagem(body: CatalogoItemBody): Promise<CatalogoItem> {
  return postJson('/tipos-de-abordagem', body);
}
export function updateTipoDeAbordagem(id: string, body: Partial<CatalogoItemBody>): Promise<CatalogoItem> {
  return patchJson(`/tipos-de-abordagem/${id}`, body);
}
export function deleteTipoDeAbordagem(id: string): Promise<void> {
  return deleteJson(`/tipos-de-abordagem/${id}`);
}

// ── Painel + relatório ────────────────────────────────────────────────────

export function getDashboard(): Promise<Dashboard> {
  return request('/dashboard');
}

export function getCirurgiasPorArea(): Promise<CirurgiasPorArea> {
  return request('/cirurgias-por-area');
}
