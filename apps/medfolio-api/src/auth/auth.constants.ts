export const SESSION_COOKIE = 'medfolio_session';
export const CHALLENGE_COOKIE = 'medfolio_2fa_challenge';

export interface SessionPayload {
  sub: string;
  typ: 'session';
}

export interface ChallengePayload {
  sub: string;
  typ: '2fa_challenge';
}
