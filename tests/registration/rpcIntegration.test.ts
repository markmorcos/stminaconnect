/**
 * Integration tests for the Quick Add RPCs against a live local
 * Supabase. Mirrors the gating in `tests/persons/rpcIntegration.test.ts`:
 * skipped unless `RUN_INTEGRATION_TESTS=1` and a stack is running with
 * migrations + seed applied.
 *
 * Run with: `RUN_INTEGRATION_TESTS=1 npm test -- registration/rpcIntegration`
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === '1';
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

function freshClient(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = freshClient();
  const { error } = await client.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw error;
  return client;
}

async function servantIdByEmail(client: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await client.from('servants').select('id').eq('email', email).single();
  if (error || !data) throw new Error(`servant lookup failed for ${email}`);
  return (data as { id: string }).id;
}

describeIntegration('find_potential_duplicate (live Supabase)', () => {
  it('returns the matching row id when an exact match exists', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const adminId = await servantIdByEmail(admin, 'priest@stminaconnect.com');

    const phone = `+4917000${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0')}`;
    const { data: id, error } = await admin.rpc('create_person', {
      payload: {
        first_name: 'IntegrationDup',
        last_name: 'Candidate',
        phone,
        language: 'en',
        assigned_servant: adminId,
        registration_type: 'quick_add',
      },
    });
    expect(error).toBeNull();
    expect(typeof id).toBe('string');

    const { data: matchId } = await admin.rpc('find_potential_duplicate', {
      first: 'IntegrationDup',
      last: 'Candidate',
      phone,
    });
    expect(matchId).toBe(id);
  });

  it('returns null when there is no match', async () => {
    const client = await signInAs('priest@stminaconnect.com');
    const { data: matchId } = await client.rpc('find_potential_duplicate', {
      first: 'Nobody',
      last: 'AtAll',
      phone: '+490000000000000',
    });
    expect(matchId).toBeNull();
  });

  it('ignores soft-deleted matches', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const adminId = await servantIdByEmail(admin, 'priest@stminaconnect.com');
    const phone = `+4917001${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0')}`;
    const { data: id } = await admin.rpc('create_person', {
      payload: {
        first_name: 'IntegrationDeleted',
        last_name: 'Person',
        phone,
        language: 'en',
        assigned_servant: adminId,
        registration_type: 'quick_add',
      },
    });
    expect(typeof id).toBe('string');

    const { error: delErr } = await admin.rpc('soft_delete_person', { person_id: id });
    expect(delErr).toBeNull();

    const { data: matchId } = await admin.rpc('find_potential_duplicate', {
      first: 'IntegrationDeleted',
      last: 'Person',
      phone,
    });
    expect(matchId).toBeNull();
  });
});

describeIntegration('create_person assignment rules (live Supabase)', () => {
  it('non-admin caller: payload assigned_servant is ignored, caller becomes the servant', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const otherServantId = await servantIdByEmail(admin, 'servant2@stminaconnect.com');

    const servant = await signInAs('servant1@stminaconnect.com');
    const callerId = await servantIdByEmail(servant, 'servant1@stminaconnect.com');

    const { data: id, error } = await servant.rpc('create_person', {
      payload: {
        first_name: 'Assign',
        last_name: 'Override',
        language: 'en',
        // Try to set someone else as the assigned servant — RPC must
        // override this with the caller's id.
        assigned_servant: otherServantId,
        registration_type: 'quick_add',
      },
    });
    expect(error).toBeNull();
    expect(typeof id).toBe('string');

    const { data: row } = await servant.rpc('get_person', { person_id: id });
    expect((row as { assigned_servant: string }).assigned_servant).toBe(callerId);
  });

  it('admin caller: explicit assigned_servant in payload is honored', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const targetId = await servantIdByEmail(admin, 'servant1@stminaconnect.com');

    const { data: id, error } = await admin.rpc('create_person', {
      payload: {
        first_name: 'AdminAssign',
        last_name: 'Honored',
        language: 'en',
        assigned_servant: targetId,
        registration_type: 'quick_add',
      },
    });
    expect(error).toBeNull();
    const { data: row } = await admin.rpc('get_person', { person_id: id });
    expect((row as { assigned_servant: string }).assigned_servant).toBe(targetId);
  });
});
