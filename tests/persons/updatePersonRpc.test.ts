/**
 * RPC integration tests for the field-level permission revision of
 * `update_person` introduced in migration 006.
 *
 * Same gating as the other live-Supabase tests: skipped unless
 * `RUN_INTEGRATION_TESTS=1`. Run with:
 *   RUN_INTEGRATION_TESTS=1 npm test -- updatePersonRpc
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
  const { error } = await client.auth.signInWithPassword({
    email,
    password: 'password123',
  });
  if (error) throw error;
  return client;
}

async function servantIdByEmail(client: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await client.from('servants').select('id').eq('email', email).single();
  if (error || !data) throw new Error(`servant lookup failed for ${email}`);
  return (data as { id: string }).id;
}

async function createPersonAssignedTo(
  admin: SupabaseClient,
  assignedServantId: string,
): Promise<string> {
  const phone = `+4917090${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`;
  const { data: id, error } = await admin.rpc('create_person', {
    payload: {
      first_name: 'UpdateTest',
      last_name: 'Person',
      phone,
      language: 'en',
      assigned_servant: assignedServantId,
      registration_type: 'full',
    },
  });
  if (error) throw error;
  return id as string;
}

describeIntegration('update_person field-level permissions (live Supabase)', () => {
  it('non-admin servant: succeeds for first_name change', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const servantId = await servantIdByEmail(admin, 'servant1@stminaconnect.com');
    const personId = await createPersonAssignedTo(admin, servantId);

    const servant = await signInAs('servant1@stminaconnect.com');
    const { error } = await servant.rpc('update_person', {
      person_id: personId,
      payload: { first_name: 'RenamedByServant' },
    });
    expect(error).toBeNull();

    const { data: row } = await servant.rpc('get_person', { person_id: personId });
    expect((row as { first_name: string }).first_name).toBe('RenamedByServant');
  });

  it('non-admin servant: rejected when payload contains priority', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const servantId = await servantIdByEmail(admin, 'servant1@stminaconnect.com');
    const personId = await createPersonAssignedTo(admin, servantId);

    const servant = await signInAs('servant1@stminaconnect.com');
    const { error } = await servant.rpc('update_person', {
      person_id: personId,
      payload: { priority: 'high' },
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/forbidden_field:priority/);
  });

  it('admin: can update all whitelisted fields in one call', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const servantId = await servantIdByEmail(admin, 'servant1@stminaconnect.com');
    const personId = await createPersonAssignedTo(admin, servantId);

    const { error } = await admin.rpc('update_person', {
      person_id: personId,
      payload: {
        first_name: 'AdminEdit',
        last_name: 'Whitelist',
        phone: '+491701234567',
        region: 'Nord',
        language: 'de',
        priority: 'high',
        comments: 'Admin note',
        status: 'active',
      },
    });
    expect(error).toBeNull();
  });

  it('any caller: payload containing assigned_servant is rejected', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const servantId = await servantIdByEmail(admin, 'servant1@stminaconnect.com');
    const personId = await createPersonAssignedTo(admin, servantId);

    const { error } = await admin.rpc('update_person', {
      person_id: personId,
      payload: { assigned_servant: servantId },
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/forbidden_field:assigned_servant/);
  });

  it('non-assigned non-admin: comments change is rejected', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const assignedTo = await servantIdByEmail(admin, 'servant1@stminaconnect.com');
    const personId = await createPersonAssignedTo(admin, assignedTo);

    // Sign in as a different servant and try to write comments.
    const otherServant = await signInAs('servant2@stminaconnect.com');
    const { error } = await otherServant.rpc('update_person', {
      person_id: personId,
      payload: { comments: 'Sneaky note' },
    });
    expect(error).not.toBeNull();
    // The outer guard (`forbidden`) fires before the per-field check
    // because the caller is neither admin nor assigned, so we accept
    // either error message.
    expect(error?.message ?? '').toMatch(/forbidden(_field:comments)?/);
  });
});
