import type { Database } from '@nexo-centro/db';
import { HospitalsService } from './hospitals.service';

function databaseForRequest(existing: unknown[]) {
  const returning = jest.fn(() => Promise.resolve([{ id: 'request-id' }]));
  const values = jest.fn((payload: { status?: string }) =>
    payload.status === 'pending' ? { returning } : Promise.resolve(undefined),
  );
  const insert = jest.fn(() => ({ values }));
  const transaction = jest.fn(
    (callback: (tx: { insert: typeof insert }) => Promise<unknown>) =>
      callback({ insert }),
  );
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve(existing)),
        })),
      })),
    })),
    insert,
    transaction,
  } as unknown as Database;
  return { db, insert, values };
}

describe('HospitalsService.requestAccess', () => {
  it('creates only a pending request without self-approval fields', async () => {
    const { db, values } = databaseForRequest([]);
    const service = new HospitalsService(db);

    await expect(
      service.requestAccess('user-id', 'hospital-id'),
    ).resolves.toEqual({ status: 'pending' });
    expect(values).toHaveBeenCalledWith({
      hospitalId: 'hospital-id',
      userId: 'user-id',
      status: 'pending',
    });
  });

  it('keeps an existing pending request pending', async () => {
    const { db, insert } = databaseForRequest([
      { id: 'request-id', status: 'pending' },
    ]);
    const service = new HospitalsService(db);

    await expect(
      service.requestAccess('user-id', 'hospital-id'),
    ).resolves.toEqual({ status: 'pending' });
    expect(insert).not.toHaveBeenCalled();
  });
});
