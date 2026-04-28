/**
 * Integration tests for the servant-dashboard RPCs introduced in
 * `supabase/migrations/029_servant_dashboard_rpcs.sql`. Covers tasks
 * 6.1, 6.2, 6.3.
 *
 *   6.1 servant_my_group filters to assigned persons only (assigned_servant
 *       = auth.uid()) and rejects cross-servant lookups for non-admins.
 *   6.2 The streak field returned by servant_my_group equals the value
 *       returned by compute_streak() invoked directly for a sampled person.
 *   6.3 servant_recent_newcomers returns persons across all servants
 *       (not just the caller's group).
 *
 * Gated on SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY /
 * SUPABASE_TEST_SERVICE_ROLE_KEY (matching the existing
 * tests/dashboard/rpcIntegration.test.ts pattern).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL ?? process.env.SUPABASE_TEST_API_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

const RUN = Boolean(URL && ANON && SERVICE);
const describeIntegration = RUN ? describe : describe.skip;

const password = 'integration-test-pw-7K';

interface User {
  id: string;
  email: string;
}

async function createUser(
  admin: SupabaseClient,
  email: string,
  role: 'admin' | 'servant',
): Promise<User> {
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

async function insertPerson(
  admin: SupabaseClient,
  fields: {
    first_name: string;
    last_name: string;
    assigned_servant: string;
    registered_by: string;
    registered_at?: string;
    region?: string | null;
    priority?: 'high' | 'medium' | 'low' | 'very_low';
    registration_type?: 'quick_add' | 'full';
  },
): Promise<string> {
  const { data, error } = await admin
    .from('persons')
    .insert({
      first_name: fields.first_name,
      last_name: fields.last_name,
      language: 'en',
      priority: fields.priority ?? 'medium',
      assigned_servant: fields.assigned_servant,
      registered_by: fields.registered_by,
      registered_at: fields.registered_at,
      registration_type: fields.registration_type ?? 'full',
      region: fields.region,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

describeIntegration('integration: servant-dashboard RPCs', () => {
  let admin: SupabaseClient;
  let servantA: User;
  let servantB: User;
  let servantAClient: SupabaseClient;
  let servantBClient: SupabaseClient;
  const created: string[] = [];
  const personIds: string[] = [];

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stamp = Date.now();
    servantA = await createUser(admin, `sd-svtA-${stamp}@stmina.test`, 'servant');
    servantB = await createUser(admin, `sd-svtB-${stamp}@stmina.test`, 'servant');
    created.push(servantA.id, servantB.id);
    servantAClient = await signedInClient(servantA.email);
    servantBClient = await signedInClient(servantB.email);

    // Two persons assigned to A, one to B.
    personIds.push(
      await insertPerson(admin, {
        first_name: 'Anna',
        last_name: 'Test',
        assigned_servant: servantA.id,
        registered_by: servantA.id,
      }),
    );
    personIds.push(
      await insertPerson(admin, {
        first_name: 'Boutros',
        last_name: 'Test',
        assigned_servant: servantA.id,
        registered_by: servantA.id,
      }),
    );
    personIds.push(
      await insertPerson(admin, {
        first_name: 'Cyrus',
        last_name: 'Test',
        assigned_servant: servantB.id,
        registered_by: servantB.id,
      }),
    );
  }, 30000);

  afterAll(async () => {
    if (!admin) return;
    if (personIds.length > 0) await admin.from('persons').delete().in('id', personIds);
    await Promise.all(created.map((id) => deleteUser(admin, id)));
  }, 30000);

  it('servant_my_group filters to the caller assigned set (6.1)', async () => {
    const { data, error } = await servantAClient.rpc('servant_my_group', { p_servant_id: null });
    expect(error).toBeNull();
    const rows = (data ?? []) as { person_id: string; first_name: string }[];
    // A's two seeded persons must appear; B's must not.
    const ids = rows.map((r) => r.person_id);
    expect(ids).toEqual(expect.arrayContaining([personIds[0], personIds[1]]));
    expect(ids).not.toContain(personIds[2]);
  });

  it('non-admin cannot ask for another servant_id (6.1)', async () => {
    const { error } = await servantAClient.rpc('servant_my_group', {
      p_servant_id: servantB.id,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/permission denied/i);
  });

  it('streak field equals compute_streak() for the same person (6.2)', async () => {
    const { data: rows, error } = await servantAClient.rpc('servant_my_group', {
      p_servant_id: null,
    });
    expect(error).toBeNull();
    const sample = (rows ?? []).find((r: { person_id: string }) => r.person_id === personIds[0]) as
      | { person_id: string; streak: number }
      | undefined;
    expect(sample).toBeDefined();
    if (!sample) return;
    const { data: cs, error: csErr } = await servantAClient.rpc('compute_streak', {
      p_person_id: sample.person_id,
    });
    expect(csErr).toBeNull();
    expect(cs).toBe(sample.streak);
  });

  it('servant_recent_newcomers returns rows across all servants (6.3)', async () => {
    const { data, error } = await servantAClient.rpc('servant_recent_newcomers', { p_days: 30 });
    expect(error).toBeNull();
    const ids = ((data ?? []) as { person_id: string }[]).map((r) => r.person_id);
    expect(ids).toEqual(expect.arrayContaining(personIds));
  });

  it('servant_pending_followups_count returns a non-negative integer', async () => {
    const { data, error } = await servantAClient.rpc('servant_pending_followups_count');
    expect(error).toBeNull();
    expect(Number.isInteger(data)).toBe(true);
    expect(data as number).toBeGreaterThanOrEqual(0);
  });

  it('unauthenticated calls fail', async () => {
    const anon = createClient(URL!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc('servant_my_group', { p_servant_id: null });
    expect(error).not.toBeNull();
  });

  // Smoke: B sees only their one person (mirror of 6.1).
  it('a different servant sees their own assignments only', async () => {
    const { data, error } = await servantBClient.rpc('servant_my_group', { p_servant_id: null });
    expect(error).toBeNull();
    const ids = ((data ?? []) as { person_id: string }[]).map((r) => r.person_id);
    expect(ids).toContain(personIds[2]);
    expect(ids).not.toContain(personIds[0]);
    expect(ids).not.toContain(personIds[1]);
  });
});

if (!RUN) {
  console.warn(
    '[servant-dashboard integration] skipping — set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY to run.',
  );
}
