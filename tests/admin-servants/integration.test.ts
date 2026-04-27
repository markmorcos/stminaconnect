/**
 * Integration tests for the admin servant lifecycle introduced in
 * `028_admin_servant_rpcs.sql` plus the `invite-servant` Edge Function.
 * Covers Section 11.2 and Section 11.3.
 *
 *   11.2.1 invite-servant creates auth + servants rows for an admin caller.
 *   11.2.2 invite-servant returns 403 for a non-admin servant caller.
 *   11.3.1 deactivate_servant flips deactivated_at; subsequent
 *          get_my_servant for that user returns null.
 *   11.3.2 reactivate_servant clears deactivated_at and restores access.
 *   11.3.3 update_servant_role refuses to demote the last active admin.
 *   11.3.4 deactivate_servant refuses to deactivate the caller (self).
 *
 * Gated on SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY /
 * SUPABASE_TEST_SERVICE_ROLE_KEY.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL ?? process.env.SUPABASE_TEST_API_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const RUN = Boolean(URL && ANON && SERVICE);
const describeIntegration = RUN ? describe : describe.skip;

const password = 'integration-test-pw-7K';

interface TestUser {
  id: string;
  email: string;
}

async function createUser(
  admin: SupabaseClient,
  email: string,
  role: 'admin' | 'servant',
): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const id = data.user.id;
  const { error: insertErr } = await admin
    .from('servants')
    .insert({ id, email, display_name: email.split('@')[0], role });
  if (insertErr) throw insertErr;
  return { id, email };
}

async function deleteUser(admin: SupabaseClient, id: string): Promise<void> {
  await admin.from('servants').delete().eq('id', id);
  await admin.auth.admin.deleteUser(id);
}

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describeIntegration('integration: admin servant lifecycle', () => {
  let admin: SupabaseClient;
  let firstAdmin: TestUser;
  let secondAdmin: TestUser;
  let servantUser: TestUser;
  let firstAdminClient: SupabaseClient;
  let servantClient: SupabaseClient;
  const created: string[] = [];
  const invitedEmails: string[] = [];

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stamp = Date.now();
    firstAdmin = await createUser(admin, `lifecycle-admin1-${stamp}@stmina.test`, 'admin');
    secondAdmin = await createUser(admin, `lifecycle-admin2-${stamp}@stmina.test`, 'admin');
    servantUser = await createUser(admin, `lifecycle-servant-${stamp}@stmina.test`, 'servant');
    created.push(firstAdmin.id, secondAdmin.id, servantUser.id);
    firstAdminClient = await signedInClient(firstAdmin.email);
    servantClient = await signedInClient(servantUser.email);
  }, 30000);

  afterAll(async () => {
    if (!admin) return;
    // Resolve invited users into ids and clean them up too.
    for (const email of invitedEmails) {
      const { data } = await admin.from('servants').select('id').eq('email', email).maybeSingle();
      const id = (data as { id: string } | null)?.id;
      if (id) created.push(id);
    }
    await Promise.all(created.map((id) => deleteUser(admin, id).catch(() => undefined)));
  }, 30000);

  it('invite-servant creates an auth row + servants row for an admin caller', async () => {
    const email = `invited-${Date.now()}@stmina.test`;
    invitedEmails.push(email);
    const { data, error } = await firstAdminClient.functions.invoke<{
      servant: { id: string; email: string; role: string };
    }>('invite-servant', {
      body: { email, displayName: 'Invitee', role: 'servant' },
    });
    expect(error).toBeNull();
    expect(data?.servant?.email).toBe(email);
    expect(data?.servant?.role).toBe('servant');
    const { data: row } = await admin
      .from('servants')
      .select('id, email, display_name, role')
      .eq('email', email)
      .single();
    expect(row).toMatchObject({ email, display_name: 'Invitee', role: 'servant' });
  });

  it('invite-servant returns 403 for a non-admin caller', async () => {
    const email = `invited-rejected-${Date.now()}@stmina.test`;
    const { data, error } = await servantClient.functions.invoke('invite-servant', {
      body: { email, displayName: 'Should Fail', role: 'servant' },
    });
    // supabase-js puts non-2xx responses into `error`; the body is
    // available via the FunctionsHttpError shape.
    expect(error).not.toBeNull();
    expect(data === null || (data as { error?: string }).error === 'forbidden').toBe(true);
  });

  it('deactivate_servant blocks subsequent get_my_servant for the deactivated user', async () => {
    // The second admin is the one we deactivate (so we're not removing the
    // last active admin). Sign them in first, confirm get_my_servant works.
    const target = secondAdmin;
    const targetClient = await signedInClient(target.email);
    const before = await targetClient.rpc('get_my_servant');
    expect(before.error).toBeNull();
    expect((before.data as { id: string } | null)?.id).toBe(target.id);

    // First admin deactivates the second admin.
    const { error: deactErr } = await firstAdminClient.rpc('deactivate_servant', {
      p_servant_id: target.id,
    });
    expect(deactErr).toBeNull();

    // The deactivated user's existing session can still call RPCs, but
    // get_my_servant now returns null (or a record with all-null fields).
    const after = await targetClient.rpc('get_my_servant');
    expect(after.error).toBeNull();
    const empty = after.data === null || (after.data as { id: string | null }).id === null;
    expect(empty).toBe(true);

    // Reactivate so afterAll cleanup hits a normal path.
    const { error: reactErr } = await firstAdminClient.rpc('reactivate_servant', {
      p_servant_id: target.id,
    });
    expect(reactErr).toBeNull();
    const restored = await targetClient.rpc('get_my_servant');
    expect((restored.data as { id: string } | null)?.id).toBe(target.id);
  });

  it('update_servant_role refuses to demote the last active admin', async () => {
    // Demote secondAdmin first (so firstAdmin is the only admin).
    await firstAdminClient.rpc('update_servant_role', {
      p_servant_id: secondAdmin.id,
      p_role: 'servant',
    });

    // Now demoting firstAdmin must fail.
    const { error } = await firstAdminClient.rpc('update_servant_role', {
      p_servant_id: firstAdmin.id,
      p_role: 'servant',
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/last active admin/i);

    // Restore secondAdmin's admin role for tidiness.
    await firstAdminClient.rpc('update_servant_role', {
      p_servant_id: secondAdmin.id,
      p_role: 'admin',
    });
  });

  it('deactivate_servant refuses to deactivate the caller', async () => {
    const { error } = await firstAdminClient.rpc('deactivate_servant', {
      p_servant_id: firstAdmin.id,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/own account/i);
  });
});

if (!RUN) {
  console.warn(
    '[admin-servants integration] skipping — set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY to run.',
  );
}
