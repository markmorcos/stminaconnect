/**
 * RPC integration tests for the servant self-service / admin update RPCs
 * introduced in migration 007.
 *
 * Gated on RUN_INTEGRATION_TESTS=1 — same pattern as the other live-Supabase
 * suites. Run with:
 *   RUN_INTEGRATION_TESTS=1 npm test -- servantProfileRpc
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

describeIntegration('update_my_servant (live Supabase)', () => {
  it('accepts a valid display name', async () => {
    const client = await signInAs('servant1@stmina.de');
    const { data, error } = await client.rpc('update_my_servant', { display_name: 'Servant One' });
    expect(error).toBeNull();
    expect((data as { display_name: string }).display_name).toBe('Servant One');
  });

  it('rejects an empty display name', async () => {
    const client = await signInAs('servant1@stmina.de');
    const { error } = await client.rpc('update_my_servant', { display_name: '   ' });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/empty/);
  });

  it('rejects a display name longer than 100 chars', async () => {
    const client = await signInAs('servant1@stmina.de');
    const { error } = await client.rpc('update_my_servant', { display_name: 'x'.repeat(101) });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/too long/);
  });
});

describeIntegration('update_servant (live Supabase)', () => {
  it('admin updates another servant display name', async () => {
    const admin = await signInAs('priest@stmina.de');
    const targetId = await servantIdByEmail(admin, 'servant2@stmina.de');
    const { data, error } = await admin.rpc('update_servant', {
      servant_id: targetId,
      payload: { display_name: 'Servant Two' },
    });
    expect(error).toBeNull();
    expect((data as { display_name: string }).display_name).toBe('Servant Two');
  });

  it('rejects non-admin callers with admin-only', async () => {
    const admin = await signInAs('priest@stmina.de');
    const targetId = await servantIdByEmail(admin, 'servant2@stmina.de');
    const servant = await signInAs('servant1@stmina.de');
    const { error } = await servant.rpc('update_servant', {
      servant_id: targetId,
      payload: { display_name: 'should not work' },
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/admin only/);
  });

  it('ignores unknown payload keys', async () => {
    const admin = await signInAs('priest@stmina.de');
    const targetId = await servantIdByEmail(admin, 'servant2@stmina.de');
    const before = await admin.from('servants').select('role').eq('id', targetId).single();
    const beforeRole = (before.data as { role: string }).role;

    const { error } = await admin.rpc('update_servant', {
      servant_id: targetId,
      payload: { display_name: 'Servant Two', role: 'admin' },
    });
    expect(error).toBeNull();

    const after = await admin.from('servants').select('role').eq('id', targetId).single();
    expect((after.data as { role: string }).role).toBe(beforeRole);
  });
});
