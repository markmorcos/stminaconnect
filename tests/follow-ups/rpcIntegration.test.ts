/**
 * Integration tests for the follow-up + on-break + return-detection
 * surfaces introduced by add-followups-and-on-break.
 *
 *   7.1 create/update follow_up + RLS
 *   7.2 mark_on_break sets status + paused_until + detection skips
 *   7.3 expire_breaks flips yesterday's expired breaks back to active
 *   7.4 attending an event resolves alerts + fires welcome_back
 *   7.5 welcome_back goes only to assigned servant (no admin spam)
 *
 * Gated on RUN_INTEGRATION_TESTS=1 — needs a running local Supabase
 * stack with all migrations + seed loaded.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === '1';
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function freshClient(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function adminClient(): SupabaseClient {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for these tests');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const c = freshClient();
  const { error } = await c.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw error;
  return c;
}

async function getServantId(svc: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await svc.from('servants').select('id').eq('email', email).single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function pickPersonAssignedTo(svc: SupabaseClient, servantId: string): Promise<string> {
  const { data, error } = await svc
    .from('persons')
    .select('id')
    .eq('assigned_servant', servantId)
    .is('deleted_at', null)
    .limit(1)
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function clearTestRows(svc: SupabaseClient, personId: string): Promise<void> {
  await svc.from('events').delete().like('google_event_id', 'test-fu-%');
  await svc.from('absence_alerts').delete().eq('person_id', personId);
  await svc
    .from('notifications')
    .delete()
    .in('type', ['absence_alert', 'welcome_back'])
    .filter('payload->>personId', 'eq', personId);
  await svc.from('follow_ups').delete().eq('person_id', personId);
}

describeIntegration('follow-ups + on-break + return-detection (live Supabase)', () => {
  // -------------------------------------------------------------------
  // 7.1 follow_ups RLS + RPCs
  // -------------------------------------------------------------------
  describe('follow_ups RLS', () => {
    let svc: SupabaseClient;
    let s1: SupabaseClient;
    let s2: SupabaseClient;
    let admin: SupabaseClient;
    let s1Id: string;
    let personId: string;
    let createdId: string;

    beforeAll(async () => {
      svc = adminClient();
      s1 = await signInAs('servant1@stminaconnect.com');
      s2 = await signInAs('servant2@stminaconnect.com');
      admin = await signInAs('priest@stminaconnect.com');
      s1Id = await getServantId(svc, 'servant1@stminaconnect.com');
      personId = await pickPersonAssignedTo(svc, s1Id);
      await svc.from('follow_ups').delete().eq('person_id', personId);
    });

    afterAll(async () => {
      await svc.from('follow_ups').delete().eq('person_id', personId);
    });

    it('create_follow_up succeeds for any servant', async () => {
      const { data, error } = await s1.rpc('create_follow_up', {
        payload: {
          person_id: personId,
          action: 'texted',
          notes: 'integration test',
          status: 'completed',
        },
      });
      expect(error).toBeNull();
      const row = data as { id: string };
      expect(row.id).toBeTruthy();
      createdId = row.id;
    });

    it('non-creator non-admin cannot SELECT', async () => {
      const { data, error } = await s2.from('follow_ups').select('id').eq('id', createdId);
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);
    });

    it('admin can SELECT all', async () => {
      const { data, error } = await admin.from('follow_ups').select('id').eq('id', createdId);
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(1);
    });

    it('creator can update within 1h', async () => {
      const { data, error } = await s1.rpc('update_follow_up', {
        p_id: createdId,
        payload: { notes: 'updated note' },
      });
      expect(error).toBeNull();
      expect((data as { notes: string }).notes).toBe('updated note');
    });

    it('non-creator update is rejected', async () => {
      const { error } = await s2.rpc('update_follow_up', {
        p_id: createdId,
        payload: { notes: 'hijack' },
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/forbidden|permission/i);
    });
  });

  // -------------------------------------------------------------------
  // 7.2 mark_on_break + streak skip
  // -------------------------------------------------------------------
  describe('on_break + streak interaction', () => {
    let svc: SupabaseClient;
    let s1: SupabaseClient;
    let s1Id: string;
    let personId: string;
    let savedStatus: string;
    let savedPausedUntil: string | null;

    beforeAll(async () => {
      svc = adminClient();
      s1 = await signInAs('servant1@stminaconnect.com');
      s1Id = await getServantId(svc, 'servant1@stminaconnect.com');
      personId = await pickPersonAssignedTo(svc, s1Id);
      const { data } = await svc
        .from('persons')
        .select('status, paused_until')
        .eq('id', personId)
        .single();
      savedStatus = (data as { status: string }).status;
      savedPausedUntil = (data as { paused_until: string | null }).paused_until;
    });

    afterAll(async () => {
      await svc
        .from('persons')
        .update({ status: savedStatus, paused_until: savedPausedUntil })
        .eq('id', personId);
      await clearTestRows(svc, personId);
    });

    beforeEach(async () => {
      await clearTestRows(svc, personId);
    });

    it('mark_on_break sets status + paused_until', async () => {
      const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await s1.rpc('mark_on_break', {
        p_person_id: personId,
        p_paused_until: future,
      });
      expect(error).toBeNull();
      expect((data as { status: string }).status).toBe('on_break');
      expect((data as { paused_until: string }).paused_until).toBe(future);
    });

    it('compute_streak skips events while paused', async () => {
      // Paused until tomorrow → an event from yesterday is in the break window.
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      await s1.rpc('mark_on_break', { p_person_id: personId, p_paused_until: tomorrow });

      const yesterday = new Date(Date.now() - 86_400_000);
      await svc.from('events').insert({
        google_event_id: 'test-fu-paused',
        title: 'Sunday Liturgy',
        start_at: yesterday.toISOString(),
        end_at: new Date(yesterday.getTime() + 3600_000).toISOString(),
        is_counted: true,
      });

      const { data, error } = await svc.rpc('compute_streak', {
        p_person_id: personId,
        p_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // 7.3 expire_breaks
  // -------------------------------------------------------------------
  describe('expire_breaks', () => {
    let svc: SupabaseClient;
    let s1Id: string;
    let personId: string;
    let savedStatus: string;
    let savedPausedUntil: string | null;

    beforeAll(async () => {
      svc = adminClient();
      s1Id = await getServantId(svc, 'servant1@stminaconnect.com');
      personId = await pickPersonAssignedTo(svc, s1Id);
      const { data } = await svc
        .from('persons')
        .select('status, paused_until')
        .eq('id', personId)
        .single();
      savedStatus = (data as { status: string }).status;
      savedPausedUntil = (data as { paused_until: string | null }).paused_until;
    });

    afterAll(async () => {
      await svc
        .from('persons')
        .update({ status: savedStatus, paused_until: savedPausedUntil })
        .eq('id', personId);
    });

    it('flips yesterday-expired breaks back to active', async () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      await svc
        .from('persons')
        .update({ status: 'on_break', paused_until: yesterday })
        .eq('id', personId);

      const { data: count, error } = await svc.rpc('expire_breaks');
      expect(error).toBeNull();
      expect((count as number) >= 1).toBe(true);

      const { data } = await svc
        .from('persons')
        .select('status, paused_until')
        .eq('id', personId)
        .single();
      expect((data as { status: string }).status).toBe('active');
      expect((data as { paused_until: string | null }).paused_until).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // 7.4 + 7.5 return detection (welcome_back)
  // -------------------------------------------------------------------
  describe('return detection', () => {
    let svc: SupabaseClient;
    let s1: SupabaseClient;
    let s1Id: string;
    let personId: string;
    let savedRegisteredAt: string;
    const TEST_REGISTERED_AT = new Date(Date.now() - 30 * 86_400_000).toISOString();

    beforeAll(async () => {
      svc = adminClient();
      s1 = await signInAs('servant1@stminaconnect.com');
      s1Id = await getServantId(svc, 'servant1@stminaconnect.com');
      personId = await pickPersonAssignedTo(svc, s1Id);
      const { data } = await svc
        .from('persons')
        .select('registered_at')
        .eq('id', personId)
        .single();
      savedRegisteredAt = (data as { registered_at: string }).registered_at;
      await svc.from('persons').update({ registered_at: TEST_REGISTERED_AT }).eq('id', personId);
    });

    afterAll(async () => {
      await svc.from('persons').update({ registered_at: savedRegisteredAt }).eq('id', personId);
      await clearTestRows(svc, personId);
    });

    beforeEach(async () => {
      await clearTestRows(svc, personId);
      await svc
        .from('alert_config')
        .update({ grace_period_days: 0, absence_threshold: 1 })
        .eq('id', (await svc.from('alert_config').select('id').limit(1).single()).data!.id);
    });

    it('marking attendance resolves the alert and dispatches welcome_back to assigned servant only', async () => {
      // Seed an unresolved alert directly.
      const { data: alertRow } = await svc
        .from('absence_alerts')
        .insert({
          person_id: personId,
          threshold_kind: 'primary',
          streak_at_crossing: 3,
        })
        .select('id')
        .single();
      const alertId = (alertRow as { id: string }).id;

      // Insert a counted event near now (within edit window).
      const { data: ev } = await svc
        .from('events')
        .insert({
          google_event_id: 'test-fu-return',
          title: 'Sunday Liturgy',
          start_at: new Date().toISOString(),
          end_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          is_counted: true,
        })
        .select('id')
        .single();
      const eventId = (ev as { id: string }).id;

      // Mark attendance for the assigned person.
      const { error: markErr } = await s1.rpc('mark_attendance', {
        p_event_id: eventId,
        p_person_ids: [personId],
      });
      expect(markErr).toBeNull();

      // Alert should be resolved.
      const { data: resolvedAlert } = await svc
        .from('absence_alerts')
        .select('resolved_at')
        .eq('id', alertId)
        .single();
      expect((resolvedAlert as { resolved_at: string | null }).resolved_at).not.toBeNull();

      // welcome_back notification exists for s1, and only s1.
      const { data: notif } = await svc
        .from('notifications')
        .select('recipient_servant_id')
        .eq('type', 'welcome_back')
        .filter('payload->>personId', 'eq', personId);
      const recipients = (notif as { recipient_servant_id: string }[]).map(
        (r) => r.recipient_servant_id,
      );
      expect(recipients).toContain(s1Id);

      // No admin or other servant should be on the welcome_back list.
      const { data: admins } = await svc.from('servants').select('id').eq('role', 'admin');
      const adminIds = (admins as { id: string }[]).map((a) => a.id);
      for (const id of adminIds) {
        if (id === s1Id) continue;
        expect(recipients).not.toContain(id);
      }
    });
  });
});
