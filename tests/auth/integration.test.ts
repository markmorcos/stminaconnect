/**
 * Integration tests against a running local Supabase stack. They:
 *   - Spin up a service-role admin client to create + delete test users.
 *   - Spin up an anon client per signed-in user to exercise RLS.
 *
 * These tests are skipped unless `SUPABASE_TEST_URL`,
 * `SUPABASE_TEST_ANON_KEY`, and `SUPABASE_TEST_SERVICE_ROLE_KEY` are
 * defined. Easiest way to populate them:
 *
 *   eval "$(npx supabase status -o env | sed 's/^/export SUPABASE_TEST_/')"
 *   make test
 *
 * (Or inline: `SUPABASE_TEST_URL=$(npx supabase status -o env | grep ^API_URL=…)`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL ?? process.env.SUPABASE_TEST_API_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const RUN = Boolean(URL && ANON && SERVICE);
const describeIntegration = RUN ? describe : describe.skip;

interface TestUser {
  id: string;
  email: string;
  password: string;
}

const password = 'integration-test-pw-7K';

async function createUser(admin: SupabaseClient, email: string, role: 'admin' | 'servant') {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('user create failed');
  const id = data.user.id;
  const { error: insertErr } = await admin
    .from('servants')
    .insert({ id, email, display_name: email.split('@')[0], role });
  if (insertErr) throw insertErr;
  return { id, email, password };
}

async function deleteUser(admin: SupabaseClient, id: string) {
  await admin.from('servants').delete().eq('id', id);
  await admin.auth.admin.deleteUser(id);
}

async function signedInClient(email: string) {
  const client = createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describeIntegration('integration: get_my_servant + RLS', () => {
  let admin: SupabaseClient;
  const created: string[] = [];
  let alice: TestUser; // role: 'servant'
  let bob: TestUser; // role: 'servant'
  let priest: TestUser; // role: 'admin'
  let orphan: TestUser; // auth user with no servant row

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const stamp = Date.now();
    alice = await createUser(admin, `alice-${stamp}@stmina.test`, 'servant');
    created.push(alice.id);
    bob = await createUser(admin, `bob-${stamp}@stmina.test`, 'servant');
    created.push(bob.id);
    priest = await createUser(admin, `priest-${stamp}@stmina.test`, 'admin');
    created.push(priest.id);

    const { data, error } = await admin.auth.admin.createUser({
      email: `orphan-${stamp}@stmina.test`,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error('orphan create failed');
    orphan = { id: data.user.id, email: data.user.email!, password };
    created.push(orphan.id);
  }, 30000);

  afterAll(async () => {
    if (!admin) return;
    await Promise.all(created.map((id) => deleteUser(admin, id)));
  }, 30000);

  it('get_my_servant returns the caller row for a configured servant', async () => {
    const client = await signedInClient(alice.email);
    const { data, error } = await client.rpc('get_my_servant');
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: alice.id, role: 'servant' });
  });

  it('get_my_servant returns null for an auth user with no servant row', async () => {
    const client = await signedInClient(orphan.email);
    const { data, error } = await client.rpc('get_my_servant');
    expect(error).toBeNull();
    // PostgREST serializes a function returning a missing composite
    // row as a record with all-null fields, not literal JSON `null`.
    // The `fetchMyServant` wrapper normalizes both to `null`; here we
    // verify the underlying contract: id is absent.
    const empty = data === null || (data as { id: string | null }).id === null;
    expect(empty).toBe(true);
  });

  it("RLS: a servant cannot read another servant's row directly", async () => {
    const client = await signedInClient(alice.email);
    const { data, error } = await client.from('servants').select('*').eq('id', bob.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('RLS: an admin can read every servants row', async () => {
    const client = await signedInClient(priest.email);
    const { data, error } = await client.from('servants').select('id');
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([alice.id, bob.id, priest.id]));
  });
});

if (!RUN) {
  // Surfaced once during the run so contributors know why tests are skipped.
  console.warn(
    '[auth integration] skipping — set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY to run.',
  );
}
