/**
 * Unit tests for the local-first `services/api/persons.ts` wrappers.
 * Reads come from the SQLite repo; writes apply locally + enqueue an
 * op into the sync queue. We mock the underlying repos and queue so
 * the wrapper logic is exercised in isolation.
 */
/* eslint-disable import/first -- jest.mock() is hoisted; imports follow */
jest.mock('@/services/db/repositories/personsRepo', () => ({
  listPersons: jest.fn(),
  getPerson: jest.fn(),
  upsertPersons: jest.fn(),
  softDeletePersons: jest.fn(),
  rewritePersonId: jest.fn(),
}));

jest.mock('@/services/db/repositories/queueRepo', () => ({
  enqueue: jest.fn().mockResolvedValue(1),
}));

jest.mock('@/services/sync/SyncEngine', () => ({
  getSyncEngine: () => ({ kick: jest.fn(), runOnce: jest.fn() }),
}));

jest.mock('@/services/db/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('@/state/authStore', () => ({
  useAuthStore: { getState: () => ({ servant: { id: 'servant-1' } }) },
}));

const mockRpc = jest.fn();
jest.mock('@/services/api/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  assignPerson,
  createPerson,
  findPotentialDuplicate,
  getPerson,
  listPersons,
  softDeletePerson,
  updatePerson,
} from '@/services/api/persons';
import { getDatabase } from '@/services/db/database';
import * as personsRepo from '@/services/db/repositories/personsRepo';
import { enqueue } from '@/services/db/repositories/queueRepo';
/* eslint-enable import/first */

beforeEach(() => {
  (personsRepo.listPersons as jest.Mock).mockReset();
  (personsRepo.getPerson as jest.Mock).mockReset();
  (personsRepo.upsertPersons as jest.Mock).mockReset();
  (personsRepo.softDeletePersons as jest.Mock).mockReset();
  (enqueue as jest.Mock).mockClear();
  mockRpc.mockReset();
});

describe('listPersons (local-first)', () => {
  it('reads from the local repository and forwards the filter', async () => {
    (personsRepo.listPersons as jest.Mock).mockResolvedValue([{ id: 'p1' }]);
    const out = await listPersons({ region: 'Schwabing', search: 'A' });
    expect(personsRepo.listPersons).toHaveBeenCalledWith({ region: 'Schwabing', search: 'A' });
    expect(out).toEqual([{ id: 'p1' }]);
  });
});

describe('getPerson (local-first)', () => {
  it('returns the cached row', async () => {
    (personsRepo.getPerson as jest.Mock).mockResolvedValue({ id: 'p1' });
    expect(await getPerson('p1')).toEqual({ id: 'p1' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('falls back to the get_person RPC and caches the result on local miss', async () => {
    (personsRepo.getPerson as jest.Mock).mockResolvedValue(null);
    const remote = {
      id: 'p2',
      first_name: 'A',
      last_name: 'B',
      phone: null,
      region: null,
      language: 'en',
      priority: 'medium',
      assigned_servant: 'servant-1',
      comments: null,
      status: 'active',
      paused_until: null,
      registration_type: 'full',
      registered_by: 'servant-1',
      registered_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    };
    mockRpc.mockResolvedValue({ data: remote, error: null });
    const out = await getPerson('p2');
    expect(out).toEqual(remote);
    expect(mockRpc).toHaveBeenCalledWith('get_person', { person_id: 'p2' });
    expect(personsRepo.upsertPersons).toHaveBeenCalledWith([remote], 'synced');
  });

  it('returns null when the RPC reports the row was deleted server-side', async () => {
    (personsRepo.getPerson as jest.Mock).mockResolvedValue(null);
    mockRpc.mockResolvedValue({
      data: { id: 'p3', deleted_at: '2026-04-27T00:00:00Z' },
      error: null,
    });
    expect(await getPerson('p3')).toBeNull();
    expect(personsRepo.upsertPersons).not.toHaveBeenCalled();
  });

  it('returns null when the RPC returns an empty composite (id null)', async () => {
    (personsRepo.getPerson as jest.Mock).mockResolvedValue(null);
    mockRpc.mockResolvedValue({ data: { id: null }, error: null });
    expect(await getPerson('missing')).toBeNull();
  });
});

describe('createPerson (optimistic + enqueue)', () => {
  it('inserts a temp_id row locally and enqueues create_person', async () => {
    const id = await createPerson({
      first_name: 'A',
      last_name: 'B',
      language: 'en',
      registration_type: 'quick_add',
    });
    expect(id).toMatch(/^temp-/);
    expect(personsRepo.upsertPersons).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id,
          first_name: 'A',
          last_name: 'B',
          assigned_servant: 'servant-1',
        }),
      ],
      'pending',
    );
    expect(enqueue).toHaveBeenCalledWith({
      op_type: 'create_person',
      payload: { payload: expect.objectContaining({ first_name: 'A' }) },
      temp_id: id,
    });
  });
});

describe('updatePerson (optimistic + enqueue)', () => {
  it('updates the local cache and enqueues update_person', async () => {
    const existing = {
      id: 'p1',
      first_name: 'A',
      last_name: 'B',
      phone: null,
      region: null,
      language: 'en',
      priority: 'medium',
      assigned_servant: 's1',
      comments: null,
      status: 'new',
      paused_until: null,
      registration_type: 'quick_add',
      registered_by: 's1',
      registered_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    };
    (personsRepo.getPerson as jest.Mock).mockResolvedValue(existing);
    const out = await updatePerson('p1', { first_name: 'A2', priority: 'high' });
    expect(out).toMatchObject({ first_name: 'A2', priority: 'high' });
    expect(personsRepo.upsertPersons).toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith({
      op_type: 'update_person',
      payload: { person_id: 'p1', payload: { first_name: 'A2', priority: 'high' } },
    });
  });
});

describe('assignPerson / softDeletePerson (enqueue)', () => {
  it('assignPerson enqueues with reason', async () => {
    (personsRepo.getPerson as jest.Mock).mockResolvedValue(null);
    await assignPerson('p1', 's2', 'region change');
    expect(enqueue).toHaveBeenCalledWith({
      op_type: 'assign_person',
      payload: { person_id: 'p1', servant_id: 's2', reason: 'region change' },
    });
  });

  it('softDeletePerson updates local + enqueues', async () => {
    await softDeletePerson('p1');
    expect(personsRepo.softDeletePersons).toHaveBeenCalledWith(['p1']);
    expect(enqueue).toHaveBeenCalledWith({
      op_type: 'soft_delete_person',
      payload: { person_id: 'p1' },
    });
  });
});

describe('findPotentialDuplicate (local SELECT)', () => {
  it('returns the matching id when name+phone collides', async () => {
    const fakeDb = {
      getAllAsync: jest.fn().mockResolvedValue([{ id: 'p99' }]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(fakeDb);
    const id = await findPotentialDuplicate('A', 'B', '+49 123');
    expect(id).toBe('p99');
    expect(fakeDb.getAllAsync).toHaveBeenCalled();
  });

  it('returns null when nothing matches', async () => {
    const fakeDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(fakeDb);
    expect(await findPotentialDuplicate('A', 'B', '+49 123')).toBeNull();
  });
});
