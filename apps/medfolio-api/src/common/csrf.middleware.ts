import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  ADMIN_SESSION_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
} from '../auth/auth.constants';
import { readCookie } from './request-cookie';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Public auth routes that never carry a session and must not require CSRF
const CSRF_EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

export function csrfProtection(allowedOrigins: ReadonlySet<string>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      res
        .status(403)
        .json({ statusCode: 403, message: 'Origem não autorizada.' });
      return;
    }

    if (CSRF_EXEMPT_PATHS.has(req.path)) {
      next();
      return;
    }

    const adminRoute = req.path === '/admin' || req.path.startsWith('/admin/');
    const sessionCookie = adminRoute ? ADMIN_SESSION_COOKIE : SESSION_COOKIE;
    const csrfCookie = adminRoute ? ADMIN_CSRF_COOKIE : CSRF_COOKIE;
    const csrfHeader = adminRoute ? ADMIN_CSRF_HEADER : CSRF_HEADER;
    if (!readCookie(req, sessionCookie)) {
      next();
      return;
    }

    const cookieToken = readCookie(req, csrfCookie);
    const headerToken = req.get(csrfHeader);
    if (!safeEqual(cookieToken, headerToken)) {
      res
        .status(403)
        .json({ statusCode: 403, message: 'Token CSRF inválido.' });
      return;
    }

    next();
  };
}

function safeEqual(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
