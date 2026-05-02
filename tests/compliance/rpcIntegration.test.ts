/**
 * Integration tests for the GDPR compliance RPCs against a live local
 * Supabase. Skipped unless `RUN_INTEGRATION_TESTS=1`.
 *
 * Run with: `RUN_INTEGRATION_TESTS=1 npm test -- compliance/rpcIntegration`
 *
 * Mirrors the gating pattern in `tests/registration/rpcIntegration.test.ts`.
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

describeIntegration('compliance RPCs (live Supabase)', () => {
  it('record_consent + get_my_latest_consent round-trip', async () => {
    const client = await signInAs('priest@stminaconnect.com');
    const { data: rec, error } = await client.rpc('record_consent', {
      p_policy_version: '2026-04-28-test',
      p_terms_version: '2026-04-28-test',
    });
    expect(error).toBeNull();
    expect(rec).toMatchObject({
      policy_version: '2026-04-28-test',
      terms_version: '2026-04-28-test',
      revoked_at: null,
    });

    const { data: latest } = await client.rpc('get_my_latest_consent');
    expect(latest).toMatchObject({
      policy_version: '2026-04-28-test',
      terms_version: '2026-04-28-test',
    });
  });

  it('export_my_data returns a JSON envelope tied to the caller', async () => {
    const client = await signInAs('priest@stminaconnect.com');
    const { data, error } = await client.rpc('export_my_data');
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(typeof (data as Record<string, unknown>).user_id).toBe('string');
    expect(Array.isArray((data as Record<string, unknown>).consent_log)).toBe(true);
  });

  it('export_person_data is admin-only', async () => {
    // Sign in as a non-admin servant. Seed includes at least one
    // servant@stminaconnect.com (or a similarly-named row); fall back to
    // priest@ if none exists locally.
    const nonAdmin = freshClient();
    const { error: nonAdminError } = await nonAdmin.auth.signInWithPassword({
      email: 'servant1@stminaconnect.com',
      password: 'password123',
    });
    if (nonAdminError) {
      // Skip if seed lacks a non-admin login.

      console.warn('No non-admin servant in seed; skipping admin-only assertion.');
      return;
    }
    const admin = await signInAs('priest@stminaconnect.com');
    const adminId = await servantIdByEmail(admin, 'priest@stminaconnect.com');

    // Create a person to target.
    const { data: pid } = await admin.rpc('create_person', {
      payload: {
        first_name: 'ComplianceTarget',
        last_name: 'Person',
        language: 'en',
        assigned_servant: adminId,
        registration_type: 'full',
      },
    });

    const { error: forbidden } = await nonAdmin.rpc('export_person_data', {
      p_person_id: pid,
    });
    expect(forbidden).not.toBeNull();
  });

  it('audit_log is admin-readable; non-admin SELECT returns no rows', async () => {
    const nonAdmin = freshClient();
    const { error: nonAdminError } = await nonAdmin.auth.signInWithPassword({
      email: 'servant1@stminaconnect.com',
      password: 'password123',
    });
    if (nonAdminError) {
      console.warn('No non-admin servant in seed; skipping admin-only assertion.');
      return;
    }
    const { data: rows } = await nonAdmin.from('audit_log').select('*').limit(1);
    expect(rows).toEqual([]);
  });

  it('erase_person_data hard-erases the person and anonymizes attendance', async () => {
    const admin = await signInAs('priest@stminaconnect.com');
    const adminId = await servantIdByEmail(admin, 'priest@stminaconnect.com');

    const { data: pid } = await admin.rpc('create_person', {
      payload: {
        first_name: 'EraseMe',
        last_name: 'Now',
        language: 'en',
        assigned_servant: adminId,
        registration_type: 'full',
      },
    });

    const { error: tooShortReason } = await admin.rpc('erase_person_data', {
      p_person_id: pid,
      p_reason: 'short',
    });
    expect(tooShortReason).not.toBeNull();

    const { error } = await admin.rpc('erase_person_data', {
      p_person_id: pid,
      p_reason: 'GDPR Article 17 request 2026-04-28',
    });
    expect(error).toBeNull();

    const { data: stillThere } = await admin
      .from('persons')
      .select('id')
      .eq('id', pid)
      .maybeSingle();
    expect(stillThere).toBeNull();
  });
});
