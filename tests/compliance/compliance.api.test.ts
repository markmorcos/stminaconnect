/**
 * Unit tests for the typed compliance API wrappers. Mocks the supabase
 * client so we can assert that each wrapper:
 *   - calls the correct RPC with the correct argument names,
 *   - propagates errors,
 *   - shapes the response.
 */
import {
  erasePersonData,
  exportMyData,
  exportPersonData,
  getMyLatestConsent,
  listAuditLog,
  listMyConsentHistory,
  recordConsent,
  revokeConsent,
} from '@/services/api/compliance';
import { supabase } from '@/services/api/supabase';

jest.mock('@/services/api/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

const rpcMock = supabase.rpc as jest.Mock;
const fromMock = supabase.from as jest.Mock;
const functionsInvokeMock = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  functionsInvokeMock.mockReset();
});

describe('recordConsent', () => {
  it('forwards versions and returns the row', async () => {
    const row = {
      id: 'c1',
      user_id: 'u1',
      policy_version: '2026-04-28',
      terms_version: '2026-04-28',
      accepted_at: '2026-04-28T10:00:00Z',
      revoked_at: null,
    };
    rpcMock.mockResolvedValueOnce({ data: row, error: null });

    const result = await recordConsent('2026-04-28', '2026-04-28');

    expect(rpcMock).toHaveBeenCalledWith('record_consent', {
      p_policy_version: '2026-04-28',
      p_terms_version: '2026-04-28',
    });
    expect(result).toEqual(row);
  });

  it('throws on error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await expect(recordConsent('a', 'b')).rejects.toThrow('boom');
  });
});

describe('getMyLatestConsent', () => {
  it('returns null when there is no acceptance', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getMyLatestConsent()).toBeNull();
  });

  it('returns the latest row', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { id: 'c1', policy_version: 'v1' },
      error: null,
    });
    const row = await getMyLatestConsent();
    expect(row?.policy_version).toBe('v1');
  });
});

describe('revokeConsent', () => {
  it('passes the consent id', async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: 'c1' }, error: null });
    await revokeConsent('c1');
    expect(rpcMock).toHaveBeenCalledWith('revoke_consent', { p_consent_id: 'c1' });
  });
});

describe('exportMyData / exportPersonData', () => {
  it('exportMyData calls export_my_data without args', async () => {
    rpcMock.mockResolvedValueOnce({ data: { exported_at: 't' }, error: null });
    const env = await exportMyData();
    expect(rpcMock).toHaveBeenCalledWith('export_my_data');
    expect(env).toEqual({ exported_at: 't' });
  });

  it('exportPersonData passes the person id', async () => {
    rpcMock.mockResolvedValueOnce({ data: { person_id: 'p1' }, error: null });
    await exportPersonData('p1');
    expect(rpcMock).toHaveBeenCalledWith('export_person_data', { p_person_id: 'p1' });
  });
});

describe('erasePersonData', () => {
  it('passes id and reason', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await erasePersonData('p1', 'GDPR Article 17 request 2026-04-28');
    expect(rpcMock).toHaveBeenCalledWith('erase_person_data', {
      p_person_id: 'p1',
      p_reason: 'GDPR Article 17 request 2026-04-28',
    });
  });
});

describe('listAuditLog', () => {
  it('builds the filter payload from optional fields', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await listAuditLog({
      actor_id: 'a1',
      action: 'member.erase',
      since: '2026-01-01',
      until: '2026-12-31',
      limit: 25,
      offset: 50,
    });
    expect(rpcMock).toHaveBeenCalledWith('list_audit_log', {
      filter: {
        actor_id: 'a1',
        action: 'member.erase',
        since: '2026-01-01',
        until: '2026-12-31',
        limit: '25',
        offset: '50',
      },
    });
  });

  it('omits undefined fields', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    await listAuditLog();
    expect(rpcMock).toHaveBeenCalledWith('list_audit_log', { filter: {} });
  });
});

describe('listMyConsentHistory', () => {
  it('queries the consent_log table ordered by accepted_at desc', async () => {
    const orderMock = jest.fn().mockResolvedValueOnce({ data: [], error: null });
    const selectMock = jest.fn().mockReturnValueOnce({ order: orderMock });
    fromMock.mockReturnValueOnce({ select: selectMock });

    await listMyConsentHistory();

    expect(fromMock).toHaveBeenCalledWith('consent_log');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(orderMock).toHaveBeenCalledWith('accepted_at', { ascending: false });
  });
});
