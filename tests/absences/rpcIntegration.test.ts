/**
 * Integration tests for absence-detection.
 *
 *   8.1  compute_streak returns 0 when person attended last counted event
 *   8.2  compute_streak returns N when person missed last N counted events
 *   8.3  compute_streak ignores non-counted events
 *   8.4  streak ignores events during a break (paused_until > start_at)
 *   8.5  marking attendance, then unmarking, fires no duplicate alert
 *   8.6  high (threshold 2) fires after 2 misses; medium (global 3) after 3
 *   8.7  escalation fires only after primary, when streak crosses higher
 *   8.8  notification of type 'absence_alert' lands in assigned servant inbox
 *   8.9  notify_admin_on_alert=true produces additional admin notifications
 *
 * Gated on RUN_INTEGRATION_TESTS=1 — needs a running local Supabase
 * stack with all migrations + seed loaded. The service-role client
 * mutates `events`, `attendance`, and `alert_config` directly because
 * tests must arrange precise streak shapes that no client RPC exposes.
 *
 * Each test isolates its own data via google_event_id="test-abs-*"
 * prefix; cleanup runs in afterEach to keep re-runs deterministic.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === '1';
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function adminClient(): SupabaseClient {
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for these tests');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface SeededEvent {
  id: string;
  start_at: string;
}

async function clearTestEvents(svc: SupabaseClient): Promise<void> {
  await svc.from('events').delete().like('google_event_id', 'test-abs-%');
}

async function clearTestAlerts(svc: SupabaseClient, personId: string): Promise<void> {
  await svc.from('absence_alerts').delete().eq('person_id', personId);
  await svc
    .from('notifications')
    .delete()
    .eq('type', 'absence_alert')
    .filter('payload->>personId', 'eq', personId);
}

async function insertEvent(
  svc: SupabaseClient,
  tag: string,
  startAt: Date,
  isCounted: boolean,
): Promise<SeededEvent> {
  const { data, error } = await svc
    .from('events')
    .insert({
      google_event_id: `test-abs-${tag}`,
      title: isCounted ? 'Sunday Liturgy' : 'Bible Study',
      start_at: startAt.toISOString(),
      end_at: new Date(startAt.getTime() + 60 * 60_000).toISOString(),
      is_counted: isCounted,
    })
    .select('id, start_at')
    .single();
  if (error) throw error;
  return data as SeededEvent;
}

async function pickSeededPersonId(svc: SupabaseClient): Promise<string> {
  const { data, error } = await svc
    .from('persons')
    .select('id')
    .is('deleted_at', null)
    .limit(1)
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function setPersonPriority(
  svc: SupabaseClient,
  personId: string,
  priority: 'high' | 'medium' | 'low' | 'very_low',
): Promise<void> {
  await svc.from('persons').update({ priority }).eq('id', personId);
}

async function setPausedUntil(
  svc: SupabaseClient,
  personId: string,
  pausedUntil: string | null,
): Promise<void> {
  await svc.from('persons').update({ paused_until: pausedUntil }).eq('id', personId);
}

async function setRegisteredAt(
  svc: SupabaseClient,
  personId: string,
  registeredAt: string,
): Promise<void> {
  await svc.from('persons').update({ registered_at: registeredAt }).eq('id', personId);
}

async function setAlertConfig(
  svc: SupabaseClient,
  cfg: {
    absence_threshold?: number;
    priority_thresholds?: Record<string, number | null>;
    notify_admin_on_alert?: boolean;
    escalation_threshold?: number | null;
    grace_period_days?: number;
  },
): Promise<void> {
  // Service role bypasses RLS; we update the singleton directly so the
  // test doesn't need an admin auth session.
  const { data: row, error: readErr } = await svc
    .from('alert_config')
    .select('id')
    .limit(1)
    .single();
  if (readErr) throw readErr;
  await svc
    .from('alert_config')
    .update(cfg)
    .eq('id', (row as { id: string }).id);
}

describeIntegration('absence-detection (live Supabase)', () => {
  let svc: SupabaseClient;
  let personId: string;
  let savedPriority: string;
  let savedAssigned: string;
  let savedRegisteredAt: string;
  // Anchor `registered_at` well before any test event so the cold-start
  // filter in `compute_streak` (event.start_at >= persons.registered_at)
  // doesn't filter the test events out.
  const TEST_REGISTERED_AT = new Date(Date.now() - 30 * 86_400_000).toISOString();

  beforeAll(async () => {
    svc = adminClient();
    personId = await pickSeededPersonId(svc);
    const { data } = await svc
      .from('persons')
      .select('priority, assigned_servant, registered_at')
      .eq('id', personId)
      .single();
    savedPriority = (data as { priority: string }).priority;
    savedAssigned = (data as { assigned_servant: string }).assigned_servant;
    savedRegisteredAt = (data as { registered_at: string }).registered_at;
  });

  beforeEach(async () => {
    await clearTestEvents(svc);
    await clearTestAlerts(svc, personId);
    await setPausedUntil(svc, personId, null);
    await setPersonPriority(svc, personId, savedPriority as 'medium');
    await setRegisteredAt(svc, personId, TEST_REGISTERED_AT);
    await setAlertConfig(svc, {
      absence_threshold: 3,
      priority_thresholds: { high: 2, medium: 3, low: 4, very_low: 6 },
      notify_admin_on_alert: false,
      escalation_threshold: null,
      // Tests use synthetic events as recent as 30 minutes ago. The
      // grace-period filter (022_grace_period.sql) would mask them out
      // by default, so we force it off here. The dedicated grace test
      // overrides this within its own scope.
      grace_period_days: 0,
    });
  });

  afterAll(async () => {
    await clearTestEvents(svc);
    await clearTestAlerts(svc, personId);
    await setPausedUntil(svc, personId, null);
    await setPersonPriority(svc, personId, savedPriority as 'medium');
    await setRegisteredAt(svc, personId, savedRegisteredAt);
  });

  // -------------------------------------------------------------------
  // compute_streak — 8.1, 8.2, 8.3, 8.4
  // -------------------------------------------------------------------
  describe('compute_streak', () => {
    it('returns 0 when person attended the most recent counted event', async () => {
      const e1 = await insertEvent(svc, 's0-1', new Date(Date.now() - 3 * 86_400_000), true);
      const e2 = await insertEvent(svc, 's0-2', new Date(Date.now() - 2 * 86_400_000), true);
      // Mark the most recent (e2) attended.
      await svc.from('attendance').insert({
        event_id: e2.id,
        person_id: personId,
        marked_by: savedAssigned,
        is_present: true,
      });

      const { data, error } = await svc.rpc('compute_streak', {
        p_person_id: personId,
        p_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toBe(0);
      void e1;
    });

    it('returns N when person missed the last N counted events', async () => {
      await insertEvent(svc, 'sN-1', new Date(Date.now() - 3 * 86_400_000), true);
      await insertEvent(svc, 'sN-2', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'sN-3', new Date(Date.now() - 1 * 86_400_000), true);
      const { data, error } = await svc.rpc('compute_streak', {
        p_person_id: personId,
        p_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toBe(3);
    });

    it('ignores non-counted events', async () => {
      await insertEvent(svc, 'sNon-1', new Date(Date.now() - 3 * 86_400_000), false);
      await insertEvent(svc, 'sNon-2', new Date(Date.now() - 2 * 86_400_000), false);
      const { data, error } = await svc.rpc('compute_streak', {
        p_person_id: personId,
        p_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toBe(0);
    });

    it('ignores events older than persons.registered_at (cold-start)', async () => {
      // Person registered 1 day ago; insert two counted events from 5 and
      // 3 days ago. Both predate registration → streak should be 0.
      await setRegisteredAt(svc, personId, new Date(Date.now() - 1 * 86_400_000).toISOString());
      await insertEvent(svc, 'cs-1', new Date(Date.now() - 5 * 86_400_000), true);
      await insertEvent(svc, 'cs-2', new Date(Date.now() - 3 * 86_400_000), true);
      const { data, error } = await svc.rpc('compute_streak', {
        p_person_id: personId,
        p_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toBe(0);
    });

    it('ignores events newer than now() - grace_period_days', async () => {
      // grace=3: events from yesterday and 2 days ago are too recent to
      // count, even though they are missed. The 5-day-old event still
      // counts → streak = 1.
      await setAlertConfig(svc, {
        absence_threshold: 3,
        priority_thresholds: { high: 2, medium: 3, low: 4, very_low: 6 },
        notify_admin_on_alert: false,
        grace_period_days: 3,
      });
      await insertEvent(svc, 'gp-old', new Date(Date.now() - 5 * 86_400_000), true);
      await insertEvent(svc, 'gp-mid', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'gp-new', new Date(Date.now() - 1 * 86_400_000), true);
      const { data, error } = await svc.rpc('compute_streak', {
        p_person_id: personId,
        p_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toBe(1);
    });

    it('skips events during a break (paused_until > start_at)', async () => {
      // E5 (most recent) missed → streak = 1. E4, E3 inside break → skipped.
      // E2 attended → return 1.
      const e3 = await insertEvent(svc, 'br-3', new Date(Date.now() - 5 * 86_400_000), true);
      const e4 = await insertEvent(svc, 'br-4', new Date(Date.now() - 4 * 86_400_000), true);
      void (await insertEvent(svc, 'br-2', new Date(Date.now() - 6 * 86_400_000), true));
      const e5 = await insertEvent(svc, 'br-5', new Date(Date.now() - 1 * 86_400_000), true);

      // Set paused_until so it's after E3 and E4 but before E5.
      const pausedUntil = new Date(Date.now() - 2 * 86_400_000);
      await setPausedUntil(svc, personId, pausedUntil.toISOString().slice(0, 10));

      // Mark attendance for the oldest event (E2 in scenario terms).
      const { data: e2rows } = await svc
        .from('events')
        .select('id, start_at')
        .like('google_event_id', 'test-abs-br-2');
      const e2 = (e2rows as SeededEvent[])[0];
      await svc.from('attendance').insert({
        event_id: e2.id,
        person_id: personId,
        marked_by: savedAssigned,
        is_present: true,
      });

      const { data, error } = await svc.rpc('compute_streak', {
        p_person_id: personId,
        p_at: new Date().toISOString(),
      });
      expect(error).toBeNull();
      expect(data).toBe(1);
      void e3;
      void e4;
      void e5;
    });
  });

  // -------------------------------------------------------------------
  // detect_absences — 8.5, 8.6, 8.7, 8.8, 8.9
  // -------------------------------------------------------------------
  describe('detect_absences', () => {
    it('does not fire a duplicate alert on a re-run with no streak change', async () => {
      // Streak of 3 → fires once at threshold 3.
      await insertEvent(svc, 'd5-1', new Date(Date.now() - 3 * 86_400_000), true);
      await insertEvent(svc, 'd5-2', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'd5-3', new Date(Date.now() - 1 * 86_400_000), true);

      const first = await svc.rpc('detect_absences', { p_person_ids: [personId] });
      expect(first.error).toBeNull();
      expect(first.data).toBeGreaterThanOrEqual(1);

      // Re-run without changing the streak.
      const second = await svc.rpc('detect_absences', { p_person_ids: [personId] });
      expect(second.error).toBeNull();
      expect(second.data).toBe(0);

      const { data: alerts } = await svc
        .from('absence_alerts')
        .select('id')
        .eq('person_id', personId)
        .eq('threshold_kind', 'primary');
      expect((alerts as unknown[]).length).toBe(1);
    });

    it('high-priority threshold of 2 fires sooner than medium global of 3', async () => {
      await setPersonPriority(svc, personId, 'high');
      await insertEvent(svc, 'pri-1', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'pri-2', new Date(Date.now() - 1 * 86_400_000), true);

      const { data, error } = await svc.rpc('detect_absences', { p_person_ids: [personId] });
      expect(error).toBeNull();
      expect(data).toBeGreaterThanOrEqual(1);

      const { data: alerts } = await svc
        .from('absence_alerts')
        .select('streak_at_crossing, threshold_kind')
        .eq('person_id', personId);
      expect((alerts as { streak_at_crossing: number; threshold_kind: string }[]).length).toBe(1);
      expect(
        (alerts as { streak_at_crossing: number; threshold_kind: string }[])[0].threshold_kind,
      ).toBe('primary');
    });

    it('medium person needs 3 misses to fire (global threshold)', async () => {
      await setPersonPriority(svc, personId, 'medium');
      // Override priority_thresholds for medium to NULL so global applies.
      await setAlertConfig(svc, {
        absence_threshold: 3,
        priority_thresholds: { high: 2, low: 4, very_low: 6 },
        notify_admin_on_alert: false,
      });
      await insertEvent(svc, 'pri-1', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'pri-2', new Date(Date.now() - 1 * 86_400_000), true);

      const r1 = await svc.rpc('detect_absences', { p_person_ids: [personId] });
      expect(r1.error).toBeNull();
      expect(r1.data).toBe(0);

      // Add a third missed event → crosses threshold 3.
      await insertEvent(svc, 'pri-3', new Date(Date.now() - 1 * 3600_000), true);
      const r2 = await svc.rpc('detect_absences', { p_person_ids: [personId] });
      expect(r2.error).toBeNull();
      expect(r2.data).toBeGreaterThanOrEqual(1);
    });

    it('escalation alert fires only when streak crosses escalation_threshold', async () => {
      await setAlertConfig(svc, {
        absence_threshold: 2,
        priority_thresholds: { medium: 2 },
        notify_admin_on_alert: false,
        escalation_threshold: 4,
      });
      // Streak 3 → primary fires, escalation does not.
      await insertEvent(svc, 'esc-1', new Date(Date.now() - 3 * 86_400_000), true);
      await insertEvent(svc, 'esc-2', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'esc-3', new Date(Date.now() - 1 * 86_400_000), true);

      await svc.rpc('detect_absences', { p_person_ids: [personId] });
      const { data: a1 } = await svc
        .from('absence_alerts')
        .select('threshold_kind')
        .eq('person_id', personId);
      const kinds1 = (a1 as { threshold_kind: string }[]).map((r) => r.threshold_kind).sort();
      expect(kinds1).toEqual(['primary']);

      // Bump streak to 4 → escalation should fire.
      await insertEvent(svc, 'esc-4', new Date(Date.now() - 30 * 60_000), true);
      await svc.rpc('detect_absences', { p_person_ids: [personId] });
      const { data: a2 } = await svc
        .from('absence_alerts')
        .select('threshold_kind')
        .eq('person_id', personId);
      const kinds2 = (a2 as { threshold_kind: string }[]).map((r) => r.threshold_kind).sort();
      expect(kinds2).toEqual(['escalation', 'primary']);
    });

    it('dispatches a notification of type absence_alert to the assigned servant', async () => {
      await insertEvent(svc, 'na-1', new Date(Date.now() - 3 * 86_400_000), true);
      await insertEvent(svc, 'na-2', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'na-3', new Date(Date.now() - 1 * 86_400_000), true);

      await svc.rpc('detect_absences', { p_person_ids: [personId] });

      const { data: notif } = await svc
        .from('notifications')
        .select('id, recipient_servant_id, type, payload')
        .eq('type', 'absence_alert')
        .filter('payload->>personId', 'eq', personId);
      const rows = notif as {
        recipient_servant_id: string;
        payload: { personId: string };
      }[];
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.some((r) => r.recipient_servant_id === savedAssigned)).toBe(true);
    });

    it('notify_admin_on_alert=true produces additional admin notifications', async () => {
      await setAlertConfig(svc, {
        absence_threshold: 3,
        priority_thresholds: { high: 2, medium: 3, low: 4, very_low: 6 },
        notify_admin_on_alert: true,
      });

      await insertEvent(svc, 'an-1', new Date(Date.now() - 3 * 86_400_000), true);
      await insertEvent(svc, 'an-2', new Date(Date.now() - 2 * 86_400_000), true);
      await insertEvent(svc, 'an-3', new Date(Date.now() - 1 * 86_400_000), true);

      await svc.rpc('detect_absences', { p_person_ids: [personId] });

      const { data: notif } = await svc
        .from('notifications')
        .select('recipient_servant_id')
        .eq('type', 'absence_alert')
        .filter('payload->>personId', 'eq', personId);
      const rows = notif as { recipient_servant_id: string }[];

      const { data: admins } = await svc.from('servants').select('id').eq('role', 'admin');
      const adminIds = (admins as { id: string }[]).map((a) => a.id);

      // Recipients = assigned servant + admins (minus duplicate when assigned IS admin).
      const expectedRecipients = new Set<string>([savedAssigned, ...adminIds]);
      const actualRecipients = new Set(rows.map((r) => r.recipient_servant_id));
      for (const id of expectedRecipients) {
        expect(actualRecipients.has(id)).toBe(true);
      }
    });
  });
});
