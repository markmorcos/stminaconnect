/**
 * Unit tests for the `services/api/persons.ts` wrappers. Mocks
 * `supabase.rpc` so we can verify each wrapper sends the right RPC name
 * and payload, and surfaces errors from the underlying call.
 */
/* eslint-disable import/first -- jest.mock() is hoisted; imports follow */
jest.mock('@/services/api/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

import {
  assignPerson,
  createPerson,
  getPerson,
  listPersons,
  softDeletePerson,
  updatePerson,
} from '@/services/api/persons';
import { supabase } from '@/services/api/supabase';
/* eslint-enable import/first */

const mockedRpc = supabase.rpc as unknown as jest.Mock;

beforeEach(() => {
  mockedRpc.mockReset();
});

describe('listPersons', () => {
  it('calls list_persons with the filter and returns the rows', async () => {
    const row = { id: 'p1', first_name: 'A', last_name: 'B' };
    mockedRpc.mockResolvedValue({ data: [row], error: null });

    const out = await listPersons({ region: 'Schwabing', search: 'A' });
    expect(mockedRpc).toHaveBeenCalledWith('list_persons', {
      filter: { region: 'Schwabing', search: 'A' },
    });
    expect(out).toEqual([row]);
  });

  it('defaults filter to {}', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null });
    await listPersons();
    expect(mockedRpc).toHaveBeenCalledWith('list_persons', { filter: {} });
  });

  it('throws when the RPC returns an error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listPersons()).rejects.toThrow('boom');
  });
});

describe('getPerson', () => {
  it('calls get_person with the id', async () => {
    const row = { id: 'p1', first_name: 'A', last_name: 'B' };
    mockedRpc.mockResolvedValue({ data: row, error: null });

    const out = await getPerson('p1');
    expect(mockedRpc).toHaveBeenCalledWith('get_person', { person_id: 'p1' });
    expect(out).toEqual(row);
  });

  it('treats an all-null record as null', async () => {
    mockedRpc.mockResolvedValue({ data: { id: null, first_name: null }, error: null });
    expect(await getPerson('missing')).toBeNull();
  });

  it('returns null for a literal null payload', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null });
    expect(await getPerson('missing')).toBeNull();
  });
});

describe('createPerson', () => {
  it('calls create_person with the payload and returns the new id', async () => {
    mockedRpc.mockResolvedValue({ data: 'new-id', error: null });
    const id = await createPerson({
      first_name: 'A',
      last_name: 'B',
      language: 'en',
      assigned_servant: 's1',
      registration_type: 'quick_add',
    });
    expect(mockedRpc).toHaveBeenCalledWith('create_person', {
      payload: {
        first_name: 'A',
        last_name: 'B',
        language: 'en',
        assigned_servant: 's1',
        registration_type: 'quick_add',
      },
    });
    expect(id).toBe('new-id');
  });
});

describe('updatePerson', () => {
  it('calls update_person and returns the updated row', async () => {
    const row = { id: 'p1', first_name: 'A', last_name: 'B' };
    mockedRpc.mockResolvedValue({ data: row, error: null });
    const out = await updatePerson('p1', { first_name: 'A', priority: 'high' });
    expect(mockedRpc).toHaveBeenCalledWith('update_person', {
      person_id: 'p1',
      payload: { first_name: 'A', priority: 'high' },
    });
    expect(out).toEqual(row);
  });
});

describe('assignPerson', () => {
  it('calls assign_person with all three args', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null });
    await assignPerson('p1', 's2', 'region change');
    expect(mockedRpc).toHaveBeenCalledWith('assign_person', {
      person_id: 'p1',
      servant_id: 's2',
      reason: 'region change',
    });
  });

  it('throws on error', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: new Error('admin only') });
    await expect(assignPerson('p1', 's2', '')).rejects.toThrow('admin only');
  });
});

describe('softDeletePerson', () => {
  it('calls soft_delete_person', async () => {
    mockedRpc.mockResolvedValue({ data: null, error: null });
    await softDeletePerson('p1');
    expect(mockedRpc).toHaveBeenCalledWith('soft_delete_person', { person_id: 'p1' });
  });
});
