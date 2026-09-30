export const SESSION_COOKIE = 'medfolio_session';
export const CHALLENGE_COOKIE = 'medfolio_2fa_challenge';
export const CSRF_COOKIE = 'medfolio_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const ADMIN_SESSION_COOKIE = 'medfolio_admin_session';
export const ADMIN_CHALLENGE_COOKIE = 'medfolio_admin_2fa_challenge';
export const ADMIN_CSRF_COOKIE = 'medfolio_admin_csrf';
export const ADMIN_CSRF_HEADER = 'x-admin-csrf-token';
export const JWT_ISSUER = 'medfolio-api';
export const JWT_AUDIENCE = 'medfolio-web';

export interface SessionPayload {
  sub: string;
  typ: 'session';
  ver: number;
}

export interface ChallengePayload {
  sub: string;
  typ: '2fa_challenge';
  jti: string;
}
