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
import { type HospitalScope, scopeParams } from './hospitalScopeModel'

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

// If the API ever stops being same-origin, main.ts's enableCors needs
// allowedHeaders: ['Content-Type', 'X-Hospital-Id'] for the preflight to allow it.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('medfolio_csrf='))
    ?.slice('medfolio_csrf='.length);
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined),
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
const hospitalInit = (hospitalId?: string): RequestInit | undefined => hospitalId ? { headers: { 'X-Hospital-Id': hospitalId } } : undefined;

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

export function getUtentes(hospitalId?: string): Promise<Utente[]> {
  return request('/utentes', hospitalInit(hospitalId));
}

export function getUtente(id: string, hospitalId?: string): Promise<Utente> {
  return request(`/utentes/${id}`, hospitalInit(hospitalId));
}

export interface UtenteMulti extends Utente { hospitalNome: string }
export function getUtentesMulti(scope: HospitalScope, limit = 10, offset = 0, search = ''): Promise<{ rows: UtenteMulti[]; total: number }> {
  const params = scopeParams(scope);
  params.set('limit', String(limit)); params.set('offset', String(offset));
  if (search) params.set('search', search);
  return request(`/utentes/multi?${params}`);
}

export function exportUtentes(scope: HospitalScope, search = ''): Promise<void> {
  const params = scopeParams(scope);
  if (search) params.set('search', search);
  return download(`/utentes/multi/export?${params}`, 'utentes.xlsx');
}

export function getUtenteByProcesso(processo: string, hospitalId?: string): Promise<{ utente: Utente | null }> {
  return request(`/utentes/processo/${encodeURIComponent(processo)}`, hospitalInit(hospitalId));
}

export function createUtente(body: UtenteBody, hospitalId?: string): Promise<Utente> {
  return request('/utentes', { method: 'POST', body: JSON.stringify(body), headers: hospitalId ? { 'X-Hospital-Id': hospitalId } : undefined });
}

export function updateUtente(id: string, body: Partial<UtenteBody>, hospitalId?: string): Promise<Utente> {
  return request(`/utentes/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: hospitalId ? { 'X-Hospital-Id': hospitalId } : undefined });
}

export function deleteUtente(id: string, hospitalId?: string): Promise<void> {
  return request(`/utentes/${id}`, { method: 'DELETE', headers: hospitalId ? { 'X-Hospital-Id': hospitalId } : undefined });
}

// ── Catálogos partilháveis (gestão de dados) ─────────────────────────────
// Um item tem id/conteúdo únicos e associa-se a N hospitais. A listagem usa o
// âmbito (scope) na URL; criar exige um hospital concreto; associar/desassociar
// gerem a partilha. `editable` e `isGlobal` vêm calculados do servidor.

export interface CatalogHospitalRef {
  id: string;
  nome: string;
}

export interface SharedCatalogRow {
  id: string;
  nome: string;
  isGlobal: boolean;
  createdByUserId: string | null;
  hospitais: CatalogHospitalRef[];
  editable: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Conjunto de operações partilhado por todos os catálogos partilháveis. */
export interface SharedCatalogApi<TRow, TCreate, TUpdate> {
  list(scope: HospitalScope): Promise<TRow[]>;
  create(body: TCreate): Promise<TRow>;
  update(id: string, body: TUpdate): Promise<TRow>;
  remove(id: string): Promise<void>;
  associate(id: string, hospitalId: string): Promise<void>;
  disassociate(id: string, hospitalId: string): Promise<void>;
}

function sharedCatalogApi<TRow, TCreate, TUpdate>(
  base: string,
): SharedCatalogApi<TRow, TCreate, TUpdate> {
  return {
    list: (scope) => request(`${base}?${scopeParams(scope)}`),
    create: (body) => postJson(base, body),
    update: (id, body) => patchJson(`${base}/${id}`, body),
    remove: (id) => deleteJson(`${base}/${id}`),
    associate: (id, hospitalId) =>
      postJson(`${base}/${id}/hospitais`, { hospitalId }),
    disassociate: (id, hospitalId) =>
      deleteJson(`${base}/${id}/hospitais/${hospitalId}`),
  };
}

export interface EspecialidadeRow extends SharedCatalogRow {
  descricao: string | null;
}

export interface EspecialidadeBody {
  nome: string;
  descricao: string | null;
  hospitalId: string;
}

export type EspecialidadeUpdate = Partial<Pick<EspecialidadeBody, 'nome' | 'descricao'>>;

export const especialidadesApi = sharedCatalogApi<
  EspecialidadeRow,
  EspecialidadeBody,
  EspecialidadeUpdate
>('/especialidades');

export function listEspecialidades(scope: HospitalScope): Promise<EspecialidadeRow[]> {
  return especialidadesApi.list(scope);
}

// ── Zonas anatómicas ─────────────────────────────────────────────────────

export interface ZonaAnatomica extends SharedCatalogRow {
  descricao: string | null;
  ordem: number;
}

export interface ZonaAnatomicaBody {
  nome: string;
  descricao: string | null;
  hospitalId: string;
}

export type ZonaAnatomicaUpdate = Partial<Pick<ZonaAnatomicaBody, 'nome' | 'descricao'>>;

export const zonasAnatomicasApi = sharedCatalogApi<
  ZonaAnatomica,
  ZonaAnatomicaBody,
  ZonaAnatomicaUpdate
>('/zonas-anatomicas');

export function getZonasAnatomicas(scope: HospitalScope): Promise<ZonaAnatomica[]> {
  return zonasAnatomicasApi.list(scope);
}

// A ordem é por hospital: reordena dentro de um hospital concreto (cabeçalho).
export function reorderZonasAnatomicas(
  items: { id: string; ordem: number }[],
  hospitalId: string,
): Promise<void> {
  return request('/zonas-anatomicas/reorder', {
    method: 'PATCH',
    body: JSON.stringify(items),
    headers: { 'X-Hospital-Id': hospitalId },
  });
}

// ── Diagnósticos ─────────────────────────────────────────────────────────

// Diagnósticos NÃO são partilháveis: mantêm um único hospital_id (ou global).
// Têm o filtro de âmbito (via /diagnosticos/multi) mas não associação.
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

export interface DiagnosticoMulti extends Diagnostico {
  hospitalNome: string | null;
}

export interface DiagnosticoBody {
  nome: string;
  zonaAnatomicaId: string;
  tipo: TipoLesao;
  descricao?: string | null;
}

// Usado pelo formulário de registo: diagnósticos disponíveis num hospital (cabeçalho).
export function getDiagnosticos(hospitalId?: string): Promise<Diagnostico[]> {
  return request('/diagnosticos', hospitalInit(hospitalId));
}

// Usado pela página de gestão: diagnósticos no âmbito selecionado, com o nome do hospital.
export function getDiagnosticosMulti(scope: HospitalScope): Promise<DiagnosticoMulti[]> {
  return request(`/diagnosticos/multi?${scopeParams(scope)}`);
}

export function createDiagnostico(body: DiagnosticoBody, hospitalId?: string): Promise<Diagnostico> {
  return request('/diagnosticos', { method: 'POST', body: JSON.stringify(body), headers: hospitalId ? { 'X-Hospital-Id': hospitalId } : undefined });
}

export function updateDiagnostico(id: string, body: Partial<DiagnosticoBody>, hospitalId?: string): Promise<Diagnostico> {
  return request(`/diagnosticos/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: hospitalId ? { 'X-Hospital-Id': hospitalId } : undefined });
}

export function deleteDiagnostico(id: string, hospitalId?: string): Promise<void> {
  return request(`/diagnosticos/${id}`, { method: 'DELETE', headers: hospitalId ? { 'X-Hospital-Id': hospitalId } : undefined });
}

// ── Procedimentos ────────────────────────────────────────────────────────

export interface Procedimento extends SharedCatalogRow {
  especialidadeId: string | null;
  descricao: string | null;
}

export interface ProcedimentoBody {
  especialidadeId: string;
  nome: string;
  hospitalId: string;
}

export type ProcedimentoUpdate = Partial<Pick<ProcedimentoBody, 'especialidadeId' | 'nome'>>;

export const procedimentosApi = sharedCatalogApi<
  Procedimento,
  ProcedimentoBody,
  ProcedimentoUpdate
>('/procedimentos');

export function getProcedimentos(scope: HospitalScope): Promise<Procedimento[]> {
  return procedimentosApi.list(scope);
}

export function createProcedimento(body: ProcedimentoBody): Promise<Procedimento> {
  return procedimentosApi.create(body);
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

export function getCatalogosRegisto(hospitalId?: string): Promise<CatalogosRegisto> {
  return request('/catalogos/registo', hospitalInit(hospitalId));
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

function registoParams(scope: HospitalScope, filtros?: RegistoFiltros): URLSearchParams {
  const params = scopeParams(scope);
  if (filtros?.search) params.set('search', filtros.search);
  if (filtros?.dataInicio) params.set('dataInicio', filtros.dataInicio);
  if (filtros?.dataFim) params.set('dataFim', filtros.dataFim);
  if (filtros?.diagnosticoId) params.set('diagnosticoId', filtros.diagnosticoId);
  if (filtros?.procedimentoId) params.set('procedimentoId', filtros.procedimentoId);
  if (filtros?.funcaoCirurgiaoId) params.set('funcaoCirurgiaoId', filtros.funcaoCirurgiaoId);
  filtros?.tipoDeCirurgiaIds?.forEach((id) => params.append('tipoDeCirurgiaIds', id));
  return params;
}

export interface RegistoMultiResumo extends RegistoResumo {
  hospitalId: string;
  hospitalNome: string;
}

export interface RegistoPage { rows: RegistoMultiResumo[]; total: number }

export interface RegistoStatistics {
  totalRegistos: number;
  totalCirurgias: number;
  perHospital: { hospitalId: string; hospitalNome: string; registos: number; cirurgias: number }[];
  evolution: { month: string; registos: number }[];
}

export function getRegistos(scope: HospitalScope, filtros?: RegistoFiltros, limit = 10, offset = 0): Promise<RegistoPage> {
  const params = registoParams(scope, filtros);
  params.set('limit', String(limit)); params.set('offset', String(offset));
  return request(`/registos-cirurgicos?${params}`);
}

export function getRegistoStatistics(scope: HospitalScope, filtros?: RegistoFiltros): Promise<RegistoStatistics> {
  return request(`/registos-cirurgicos/statistics?${registoParams(scope, filtros)}`);
}

export function getRegisto(id: string, hospitalId: string): Promise<RegistoDetalhe> {
  return request(`/registos-cirurgicos/${id}`, { headers: { 'X-Hospital-Id': hospitalId } });
}

export function createRegisto(body: CreateRegisto, hospitalId: string): Promise<RegistoDetalhe> {
  return request('/registos-cirurgicos', { method: 'POST', body: JSON.stringify(body), headers: { 'X-Hospital-Id': hospitalId } });
}

export function updateRegisto(id: string, body: CreateRegisto, hospitalId: string): Promise<RegistoDetalhe> {
  return request(`/registos-cirurgicos/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'X-Hospital-Id': hospitalId } });
}

export function deleteRegisto(id: string, hospitalId: string): Promise<void> {
  return request(`/registos-cirurgicos/${id}`, { method: 'DELETE', headers: { 'X-Hospital-Id': hospitalId } });
}

export function exportRegistos(scope: HospitalScope, filtros?: RegistoFiltros): Promise<void> {
  return download(`/registos-cirurgicos/export?${registoParams(scope, filtros)}`, 'registos-cirurgicos.xlsx');
}

// ── Catálogos: Tipos de Cirurgia, Funções Cirurgião, Tipos de Abordagem ──────

// Catálogos partilháveis só-nome (id + nome), com âmbito e associações.
export type CatalogoItem = SharedCatalogRow;

export interface CatalogoItemBody {
  nome: string;
  hospitalId: string;
}

export type CatalogoItemUpdate = { nome: string };

export const tiposDeCirurgiaApi = sharedCatalogApi<
  CatalogoItem,
  CatalogoItemBody,
  CatalogoItemUpdate
>('/tipos-de-cirurgia');

export const funcoesCirurgiaoApi = sharedCatalogApi<
  CatalogoItem,
  CatalogoItemBody,
  CatalogoItemUpdate
>('/funcoes-cirurgiao');

export const tiposDeAbordagemApi = sharedCatalogApi<
  CatalogoItem,
  CatalogoItemBody,
  CatalogoItemUpdate
>('/tipos-de-abordagem');

// ── Painel + relatório ────────────────────────────────────────────────────

export function getDashboard(scope: HospitalScope): Promise<Dashboard> {
  return request(`/dashboard?${scopeParams(scope)}`);
}

export function getCirurgiasPorArea(scope: HospitalScope): Promise<{ total: number; reports: (CirurgiasPorArea & { hospitalId: string; hospitalNome: string })[] }> {
  return request(`/cirurgias-por-area?${scopeParams(scope)}`);
}

export function exportCirurgiasPorArea(scope: HospitalScope): Promise<void> {
  return download(`/cirurgias-por-area/export?${scopeParams(scope)}`, 'cirurgias-por-area.xlsx');
}
