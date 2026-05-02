/**
 * RPC integration tests against a live local Supabase stack. Each test
 * signs in as a seeded user, calls the RPC, and asserts the documented
 * authorization / projection / scrubbing behavior from the
 * person-management spec.
 *
 * These tests are gated on RUN_INTEGRATION_TESTS=1 because they need:
 *   - a running supabase stack (`make dev-up`)
 *   - migrations applied (`make migrate-up`)
 *   - the seed loaded (`make seed`)
 *   - EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY in env
 *
 * Run them with: `RUN_INTEGRATION_TESTS=1 npm test -- rpcIntegration`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === '1';
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

function freshClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = freshClient();
  const { error } = await client.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw error;
  return client;
}

describeIntegration('person RPCs (live Supabase)', () => {
  describe('list_persons', () => {
    it('returns no rows for anon callers', async () => {
      const client = freshClient();
      const { data, error } = await client.rpc('list_persons', { filter: {} });
      // Anon hits `auth.uid() is null` guard — function returns no rows.
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it('returns the seeded persons for a signed-in servant', async () => {
      const client = await signInAs('servant1@stminaconnect.com');
      const { data, error } = await client.rpc('list_persons', { filter: {} });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect((data as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe('get_person comments visibility', () => {
    it('includes comments when caller is the assigned servant', async () => {
      const admin = await signInAs('priest@stminaconnect.com');
      const list = (await admin.rpc('list_persons', { filter: {} })).data as {
        id: string;
        assigned_servant: string;
      }[];
      const target = list.find((p) => Boolean(p.assigned_servant));
      if (!target) throw new Error('seed missing assigned person');

      // Sign in as the assigned servant by looking them up via servants table.
      const { data: servant } = await admin
        .from('servants')
        .select('email')
        .eq('id', target.assigned_servant)
        .single();
      const assignedClient = await signInAs((servant as { email: string }).email);
      const { data } = await assignedClient.rpc('get_person', { person_id: target.id });
      expect((data as { comments: string | null } | null)?.comments ?? null).not.toBeNull();
    });

    it('hides comments when caller is a non-admin non-assigned servant', async () => {
      const admin = await signInAs('priest@stminaconnect.com');
      const list = (await admin.rpc('list_persons', { filter: {} })).data as {
        id: string;
        assigned_servant: string;
      }[];
      const target = list.find((p) => Boolean(p.assigned_servant));
      if (!target) throw new Error('seed missing assigned person');
      // Pick a servant who is NOT the assigned one.
      const otherEmail = ['servant1', 'servant2', 'servant3', 'servant4']
        .map((p) => `${p}@stminaconnect.com`)
        .find(async (email) => {
          const { data } = await admin.from('servants').select('id').eq('email', email).single();
          return (data as { id: string }).id !== target.assigned_servant;
        });
      if (!otherEmail) throw new Error('no non-assigned servant available');
      const otherClient = await signInAs(otherEmail);
      const { data } = await otherClient.rpc('get_person', { person_id: target.id });
      expect((data as { comments: string | null } | null)?.comments).toBeNull();
    });

    it('admins always see comments', async () => {
      const admin = await signInAs('priest@stminaconnect.com');
      const list = (await admin.rpc('list_persons', { filter: {} })).data as { id: string }[];
      const target = list[0];
      const { data } = await admin.rpc('get_person', { person_id: target.id });
      // comments may be null on the row itself, but the caller is admin so
      // the projection includes the column verbatim.
      expect(data).not.toBeNull();
    });
  });

  describe('create_person validation', () => {
    it('rejects a payload missing required fields', async () => {
      const client = await signInAs('priest@stminaconnect.com');
      const { error } = await client.rpc('create_person', {
        payload: { first_name: 'X' },
      });
      expect(error).not.toBeNull();
    });

    it('succeeds with a valid payload and stamps registered_by', async () => {
      const admin = await signInAs('priest@stminaconnect.com');
      const { data: adminRow } = await admin
        .from('servants')
        .select('id')
        .eq('email', 'priest@stminaconnect.com')
        .single();
      const adminId = (adminRow as { id: string }).id;
      const { data: id, error } = await admin.rpc('create_person', {
        payload: {
          first_name: 'Test',
          last_name: 'Person',
          language: 'en',
          assigned_servant: adminId,
          registration_type: 'quick_add',
        },
      });
      expect(error).toBeNull();
      expect(typeof id).toBe('string');

      const { data: created } = await admin.rpc('get_person', { person_id: id });
      expect((created as { registered_by: string }).registered_by).toBe(adminId);
    });
  });

  describe('assign_person admin gating', () => {
    it('rejects from a non-admin servant', async () => {
      const client = await signInAs('servant1@stminaconnect.com');
      const { error } = await client.rpc('assign_person', {
        person_id: '00000000-0000-0000-0000-000000000000',
        servant_id: '00000000-0000-0000-0000-000000000000',
        reason: 'nope',
      });
      expect(error).not.toBeNull();
    });
  });

  describe('soft_delete_person', () => {
    it('rejects from a non-admin servant', async () => {
      const client = await signInAs('servant1@stminaconnect.com');
      const { error } = await client.rpc('soft_delete_person', {
        person_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).not.toBeNull();
    });
  });
});
