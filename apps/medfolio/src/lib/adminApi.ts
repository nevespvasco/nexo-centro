import { ApiError } from './api';
export { ApiError } from './api';

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('medfolio_admin_csrf='))
    ?.slice('medfolio_admin_csrf='.length)
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : undefined),
      ...(csrfToken ? { 'X-Admin-CSRF-Token': decodeURIComponent(csrfToken) } : undefined),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? res.statusText, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const adminPostJson = <T>(path: string, body?: unknown) =>
  adminRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

const adminPatchJson = <T>(path: string, body?: unknown) =>
  adminRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });

export interface AdminUser {
  id: string;
  nome: string | null;
  email: string;
  hospitalId: string | null;
}

export type AdminLoginResponse =
  | { status: '2fa_required' }
  | { status: 'ok'; admin: AdminUser }

export function postAdminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  return adminPostJson('/admin/auth/login', { email, password });
}

export function postAdminLoginTwoFactor(code: string): Promise<AdminLoginResponse> {
  return adminPostJson('/admin/auth/login/2fa', { code });
}

export function getAdminMe(): Promise<AdminUser | null> {
  return adminRequest('/admin/auth/me');
}

export function postAdminLogout(): Promise<{ status: 'ok' }> {
  return adminPostJson('/admin/auth/logout');
}

export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  totalRegistosCirurgicos: number;
}

export function getAdminDashboard(): Promise<AdminDashboard> {
  return adminRequest('/admin/dashboard');
}

export interface AdminUserRow {
  id: string;
  nome: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export function getAdminUsers(): Promise<AdminUserRow[]> {
  return adminRequest('/admin/users');
}

export function patchAdminUserActive(userId: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
  return adminPatchJson(`/admin/users/${userId}/active`, { isActive });
}

export interface AdminRequest {
  id: string;
  userId: string;
  userEmail: string;
  userNome: string | null;
  hospitalId: string;
  hospitalNome: string;
  requestedAt: string;
  createdAt: string;
}

export function getAdminRequests(): Promise<AdminRequest[]> {
  return adminRequest('/admin/requests');
}

export function postAdminRequestAction(
  requestId: string,
  action: 'approve' | 'reject',
): Promise<{ status: 'approved' | 'rejected' }> {
  return adminPostJson(`/admin/requests/${requestId}`, { action });
}

export interface AdminHospitalRow {
  id: string;
  nome: string;
  createdAt: string;
}

export function getAdminHospitals(): Promise<AdminHospitalRow[]> {
  return adminRequest('/admin/hospitals');
}

export function postAdminHospital(body: { nome: string }): Promise<AdminHospitalRow> {
  return adminPostJson('/admin/hospitals', body);
}

export function patchAdminHospital(
  id: string,
  body: { nome: string },
): Promise<AdminHospitalRow> {
  return adminPatchJson(`/admin/hospitals/${id}`, body);
}
