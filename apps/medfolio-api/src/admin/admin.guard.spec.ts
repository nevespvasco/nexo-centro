import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Database } from '@nexo-centro/db';
import { AdminGuard, type AdminRequest } from './admin.guard';

function databaseReturning(rows: unknown[]): Database {
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        leftJoin: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve(rows)),
          })),
        })),
      })),
    })),
  } as unknown as Database;
}

function contextFor(request: AdminRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  function jwt(version: number): JwtService {
    return {
      verifyAsync: jest.fn(() =>
        Promise.resolve({
          sub: 'admin-id',
          typ: 'admin_session',
          ver: version,
        }),
      ),
    } as unknown as JwtService;
  }

  it('rejects a revoked admin session', async () => {
    const guard = new AdminGuard(
      jwt(1),
      databaseReturning([
        {
          id: 'admin-id',
          hospitalId: null,
          sessionVersion: 2,
          hospitalDeletedAt: null,
        },
      ]),
    );
    const request = {
      cookies: { medfolio_admin_session: 'signed-token' },
    } as AdminRequest;

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('uses the current database scope for an active admin', async () => {
    const guard = new AdminGuard(
      jwt(3),
      databaseReturning([
        {
          id: 'admin-id',
          hospitalId: 'hospital-id',
          sessionVersion: 3,
          hospitalDeletedAt: null,
        },
      ]),
    );
    const request = {
      cookies: { medfolio_admin_session: 'signed-token' },
    } as AdminRequest;

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.adminHospitalId).toBe('hospital-id');
    expect(request.adminSessionVersion).toBe(3);
  });
});
