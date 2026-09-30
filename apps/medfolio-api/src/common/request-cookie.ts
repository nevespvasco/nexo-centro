import type { Request } from 'express';

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as unknown;
  if (!cookies || typeof cookies !== 'object') return undefined;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}
