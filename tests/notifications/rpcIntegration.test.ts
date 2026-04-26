/**
 * RPC integration tests for the notifications capability.
 *
 * Mirrors the gating rules from
 * `openspec/changes/add-notification-service-mock/specs/notifications/spec.md`:
 *
 *   - `dispatch_notification` rejects non-admin direct calls.
 *   - `mark_notification_read` only succeeds for the caller's own row.
 *   - RLS denies cross-servant SELECTs.
 *
 * Gated on RUN_INTEGRATION_TESTS=1 — needs a running supabase stack
 * with migrations + seed applied.
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

async function getServantIdByEmail(client: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await client.from('servants').select('id').eq('email', email).single();
  if (error) throw error;
  return (data as { id: string }).id;
}

describeIntegration('notifications RPCs (live Supabase)', () => {
  describe('dispatch_notification', () => {
    it('rejects non-admin direct calls', async () => {
      const client = await signInAs('servant1@stmina.de');
      const adminId = await getServantIdByEmail(client, 'servant1@stmina.de');
      const { error } = await client.rpc('dispatch_notification', {
        recipient: adminId,
        type: 'system',
        payload: {},
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/admin only/i);
    });

    it('succeeds for an admin caller and returns a uuid', async () => {
      const admin = await signInAs('priest@stmina.de');
      const recipientId = await getServantIdByEmail(admin, 'servant1@stmina.de');
      const { data, error } = await admin.rpc('dispatch_notification', {
        recipient: recipientId,
        type: 'system',
        payload: { message: 'integration test' },
      });
      expect(error).toBeNull();
      expect(typeof data).toBe('string');
    });
  });

  describe('mark_notification_read', () => {
    it("only succeeds for the caller's own notification", async () => {
      const admin = await signInAs('priest@stmina.de');
      const recipientId = await getServantIdByEmail(admin, 'servant1@stmina.de');
      const { data: notifId, error: dispatchErr } = await admin.rpc('dispatch_notification', {
        recipient: recipientId,
        type: 'system',
        payload: { message: 'mark-read test' },
      });
      expect(dispatchErr).toBeNull();
      expect(typeof notifId).toBe('string');

      // A different (non-owner) servant tries to mark it — RPC returns
      // false because the WHERE clause doesn't match their auth.uid().
      const otherClient = await signInAs('servant2@stmina.de');
      const { data: otherResult, error: otherErr } = await otherClient.rpc(
        'mark_notification_read',
        { notification_id: notifId as string },
      );
      expect(otherErr).toBeNull();
      expect(otherResult).toBe(false);

      // The owner succeeds.
      const ownerClient = await signInAs('servant1@stmina.de');
      const { data: ownerResult, error: ownerErr } = await ownerClient.rpc(
        'mark_notification_read',
        { notification_id: notifId as string },
      );
      expect(ownerErr).toBeNull();
      expect(ownerResult).toBe(true);
    });
  });

  describe('RLS', () => {
    it("a servant cannot read another servant's notifications", async () => {
      const admin = await signInAs('priest@stmina.de');
      const recipientId = await getServantIdByEmail(admin, 'servant1@stmina.de');
      const { data: notifId } = await admin.rpc('dispatch_notification', {
        recipient: recipientId,
        type: 'system',
        payload: { message: 'rls test' },
      });

      const otherClient = await signInAs('servant2@stmina.de');
      const { data, error } = await otherClient
        .from('notifications')
        .select('*')
        .eq('id', notifId as string);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });
  });
});
