import type { NextFunction, Request, Response } from 'express';
import { csrfProtection } from './csrf.middleware';

function responseMock() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { response: { status } as unknown as Response, status, json };
}

function requestMock(overrides: Partial<Request>): Request {
  return {
    method: 'POST',
    path: '/',
    cookies: {},
    get: jest.fn(() => undefined),
    ...overrides,
  } as unknown as Request;
}

describe('csrfProtection', () => {
  const allowedOrigins = new Set(['https://medfolio.example.test']);

  it('rejects an unsafe browser request from another origin', () => {
    const middleware = csrfProtection(allowedOrigins);
    const { response, status } = responseMock();
    const next = jest.fn() as NextFunction;

    middleware(
      requestMock({
        get: jest.fn((name: string) =>
          name === 'origin' ? 'https://attacker.example.test' : undefined,
        ) as Request['get'],
      }),
      response,
      next,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a session-authenticated mutation without a matching token', () => {
    const middleware = csrfProtection(allowedOrigins);
    const { response, status } = responseMock();
    const next = jest.fn() as NextFunction;

    middleware(
      requestMock({
        cookies: { medfolio_session: 'session', medfolio_csrf: 'expected' },
        get: jest.fn((name: string) =>
          name === 'origin' ? 'https://medfolio.example.test' : undefined,
        ) as Request['get'],
      }),
      response,
      next,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a same-origin mutation with matching double-submit tokens', () => {
    const middleware = csrfProtection(allowedOrigins);
    const { response, status } = responseMock();
    const next = jest.fn() as NextFunction;

    middleware(
      requestMock({
        cookies: { medfolio_session: 'session', medfolio_csrf: 'token' },
        get: jest.fn((name: string) => {
          if (name === 'origin') return 'https://medfolio.example.test';
          if (name === 'x-csrf-token') return 'token';
          return undefined;
        }) as Request['get'],
      }),
      response,
      next,
    );

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requires the separate admin CSRF token on privileged routes', () => {
    const middleware = csrfProtection(allowedOrigins);
    const { response, status } = responseMock();
    const next = jest.fn() as NextFunction;

    middleware(
      requestMock({
        path: '/admin/users/user-id/active',
        cookies: {
          medfolio_admin_session: 'session',
          medfolio_admin_csrf: 'admin-token',
        },
        get: jest.fn((name: string) => {
          if (name === 'origin') return 'https://medfolio.example.test';
          if (name === 'x-admin-csrf-token') return 'admin-token';
          return undefined;
        }) as Request['get'],
      }),
      response,
      next,
    );

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
