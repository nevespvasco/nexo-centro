import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Database } from '@nexo-centro/db';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt.guard';

function databaseReturning(rows: unknown[]): Database {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve(rows)) })),
      })),
    })),
  } as unknown as Database;
}

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const request = {
    cookies: { medfolio_session: 'signed-token' },
  } as AuthenticatedRequest;

  it('rejects a JWT whose session version was revoked', async () => {
    const jwt = {
      verifyAsync: jest.fn(() =>
        Promise.resolve({
          sub: 'user-id',
          typ: 'session',
          ver: 1,
        }),
      ),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(
      jwt,
      databaseReturning([{ id: 'user-id', sessionVersion: 2 }]),
    );

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts only an active database user with the current session version', async () => {
    const jwt = {
      verifyAsync: jest.fn(() =>
        Promise.resolve({
          sub: 'user-id',
          typ: 'session',
          ver: 3,
        }),
      ),
    } as unknown as JwtService;
    const activeRequest = {
      cookies: { medfolio_session: 'signed-token' },
    } as AuthenticatedRequest;
    const guard = new JwtAuthGuard(
      jwt,
      databaseReturning([{ id: 'user-id', sessionVersion: 3 }]),
    );

    await expect(guard.canActivate(contextFor(activeRequest))).resolves.toBe(
      true,
    );
    expect(activeRequest.user).toEqual({ id: 'user-id', sessionVersion: 3 });
  });
});
