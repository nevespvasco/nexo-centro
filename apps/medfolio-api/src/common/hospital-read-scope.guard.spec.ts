import {
  BadRequestException,
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Database } from '@nexo-centro/db';
import {
  HospitalReadScopeGuard,
  type HospitalReadRequest,
} from './hospital-read-scope.guard';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

function context(query: Record<string, unknown>): {
  request: HospitalReadRequest;
  execution: ExecutionContext;
} {
  const request = {
    user: { id: 'user-id', sessionVersion: 1 },
    query,
  } as unknown as HospitalReadRequest;
  return {
    request,
    execution: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

function guardFor(ids: string[]) {
  const where = jest.fn(() => Promise.resolve(ids.map((id) => ({ id }))));
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ innerJoin: jest.fn(() => ({ where })) })),
    })),
  } as unknown as Database;
  return { guard: new HospitalReadScopeGuard(db), db };
}

describe('HospitalReadScopeGuard', () => {
  it('resolves all to the current approved memberships', async () => {
    const { guard } = guardFor([A, B]);
    const { request, execution } = context({ scope: 'all' });
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request.hospitalIds).toEqual([A, B]);
  });

  it('rejects a selected hospital outside the approved set', async () => {
    const { guard } = guardFor([A, B]);
    const { execution } = context({ scope: 'selected', hospitalId: [A, C] });
    await expect(guard.canActivate(execution)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepts an approved subset and removes duplicate IDs', async () => {
    const { guard } = guardFor([A, B, C]);
    const { request, execution } = context({
      scope: 'selected',
      hospitalId: [B, A, B],
    });
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request.hospitalIds).toEqual([B, A]);
  });

  it('resolves a selection of 50 approved hospitals', async () => {
    const ids = Array.from(
      { length: 50 },
      (_, index) =>
        `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`,
    );
    const { guard } = guardFor(ids);
    const { request, execution } = context({
      scope: 'selected',
      hospitalId: ids,
    });
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request.hospitalIds).toHaveLength(50);
  });

  it('rejects an empty selection and local filters over multiple hospitals', async () => {
    const { guard } = guardFor([A, B]);
    await expect(
      guard.canActivate(context({ scope: 'selected' }).execution),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      guard.canActivate(context({ scope: 'all', diagnosticoId: C }).execution),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
