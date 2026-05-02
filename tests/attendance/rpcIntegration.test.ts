/**
 * Integration tests for the attendance capability.
 *
 *  - 7.1 `is_event_within_edit_window` flips at 03:00 next-day Berlin
 *  - 7.2 `mark_attendance` upserts; idempotent for same payload
 *  - 7.3 `mark_attendance` outside edit window errors and inserts nothing
 *  - 7.4 `unmark_attendance` deletes only the targeted rows
 *  - 7.5 `search_persons` returns ≤25 rows and excludes soft-deleted
 *
 * Gated on RUN_INTEGRATION_TESTS=1 — needs a running local Supabase
 * stack with all migrations + seed loaded. Direct `events` /
 * `attendance` writes happen via the service-role client; RPCs are
 * called from authenticated sessions so the SECURITY DEFINER guards
 * are exercised the way the mobile client triggers them.
 *
 * Each test cleans up the rows it inserted so re-runs are idempotent.
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

async function clearTestEvents(svc: SupabaseClient): Promise<void> {
  // Cascades into attendance rows via the FK on attendance.event_id.
  await svc.from('events').delete().like('google_event_id', 'test-att-%');
}

/**
 * The edit window factors in `alert_config.grace_period_days` (added by
 * 023). Tests that depend on the original "next-day 03:00 Berlin" cutoff
 * pin the grace to 0 so they don't drift when the seed default changes.
 */
async function setGracePeriodDays(svc: SupabaseClient, days: number): Promise<void> {
  const { data: row } = await svc.from('alert_config').select('id').limit(1).single();
  await svc
    .from('alert_config')
    .update({ grace_period_days: days })
    .eq('id', (row as { id: string }).id);
}

describeIntegration('attendance RPCs (live Supabase)', () => {
  // -------------------------------------------------------------------
  // 7.1 is_event_within_edit_window — Berlin cutoff
  // -------------------------------------------------------------------
  describe('is_event_within_edit_window', () => {
    let svc: SupabaseClient;
    let servant: SupabaseClient;
    let savedGrace: number;

    beforeAll(async () => {
      svc = adminClient();
      servant = await signInAs('servant1@stminaconnect.com');
      await clearTestEvents(svc);
      const { data: cfg } = await svc
        .from('alert_config')
        .select('grace_period_days')
        .limit(1)
        .single();
      savedGrace = (cfg as { grace_period_days: number }).grace_period_days;
      await setGracePeriodDays(svc, 0);
    });

    afterAll(async () => {
      await clearTestEvents(svc);
      await setGracePeriodDays(svc, savedGrace);
    });

    it('returns true for an event within the grace window when grace > 0', async () => {
      await setGracePeriodDays(svc, 5);
      try {
        const past = new Date(Date.now() - 3 * 86_400_000);
        const { data: ev } = await svc
          .from('events')
          .insert({
            google_event_id: 'test-att-grace',
            title: 'Att Grace',
            start_at: past.toISOString(),
            end_at: new Date(past.getTime() + 60 * 60_000).toISOString(),
            is_counted: true,
          })
          .select('id')
          .single();
        const eventId = (ev as { id: string }).id;
        const { data, error } = await servant.rpc('is_event_within_edit_window', {
          p_event_id: eventId,
        });
        expect(error).toBeNull();
        expect(data).toBe(true);
      } finally {
        await setGracePeriodDays(svc, 0);
      }
    });

    it('returns true for an event whose cutoff is in the future', async () => {
      // start_at = "now" — cutoff is tomorrow @ 03:00 Berlin, comfortably future.
      const { data: ev } = await svc
        .from('events')
        .insert({
          google_event_id: 'test-att-future',
          title: 'Att Future',
          start_at: new Date().toISOString(),
          end_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          is_counted: true,
        })
        .select('id')
        .single();
      const eventId = (ev as { id: string }).id;

      const { data, error } = await servant.rpc('is_event_within_edit_window', {
        p_event_id: eventId,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    it('returns false for an event whose cutoff has already passed', async () => {
      // start_at = 3 days ago — cutoff was 2 days ago @ 03:00 Berlin.
      const past = new Date(Date.now() - 3 * 86_400_000);
      const { data: ev } = await svc
        .from('events')
        .insert({
          google_event_id: 'test-att-past',
          title: 'Att Past',
          start_at: past.toISOString(),
          end_at: new Date(past.getTime() + 60 * 60_000).toISOString(),
          is_counted: true,
        })
        .select('id')
        .single();
      const eventId = (ev as { id: string }).id;

      const { data, error } = await servant.rpc('is_event_within_edit_window', {
        p_event_id: eventId,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // 7.2 mark_attendance idempotency
  // -------------------------------------------------------------------
  describe('mark_attendance', () => {
    let svc: SupabaseClient;
    let servant: SupabaseClient;
    let eventId: string;
    let personIds: string[];

    beforeAll(async () => {
      svc = adminClient();
      servant = await signInAs('servant1@stminaconnect.com');
      await clearTestEvents(svc);

      const { data: ev } = await svc
        .from('events')
        .insert({
          google_event_id: 'test-att-mark',
          title: 'Att Mark',
          start_at: new Date().toISOString(),
          end_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          is_counted: true,
        })
        .select('id')
        .single();
      eventId = (ev as { id: string }).id;

      const { data: people } = await svc
        .from('persons')
        .select('id')
        .is('deleted_at', null)
        .limit(3);
      personIds = (people as { id: string }[]).map((p) => p.id);
    });

    afterAll(async () => {
      await clearTestEvents(svc);
    });

    it('inserts one row per (event, person) and is idempotent on repeat', async () => {
      const first = await servant.rpc('mark_attendance', {
        p_event_id: eventId,
        p_person_ids: personIds,
      });
      expect(first.error).toBeNull();

      // Calling again with the same payload must not duplicate rows —
      // the unique constraint plus the ON CONFLICT clause coalesce.
      const second = await servant.rpc('mark_attendance', {
        p_event_id: eventId,
        p_person_ids: personIds,
      });
      expect(second.error).toBeNull();

      const { data: rows } = await svc
        .from('attendance')
        .select('person_id')
        .eq('event_id', eventId);
      expect((rows as { person_id: string }[]).length).toBe(personIds.length);
    });
  });

  // -------------------------------------------------------------------
  // 7.3 mark_attendance outside the edit window
  // -------------------------------------------------------------------
  describe('mark_attendance outside edit window', () => {
    let svc: SupabaseClient;
    let servant: SupabaseClient;
    let savedGrace: number;

    beforeAll(async () => {
      svc = adminClient();
      servant = await signInAs('servant1@stminaconnect.com');
      await clearTestEvents(svc);
      const { data: cfg } = await svc
        .from('alert_config')
        .select('grace_period_days')
        .limit(1)
        .single();
      savedGrace = (cfg as { grace_period_days: number }).grace_period_days;
      await setGracePeriodDays(svc, 0);
    });

    afterAll(async () => {
      await clearTestEvents(svc);
      await setGracePeriodDays(svc, savedGrace);
    });

    it('rejects calls outside the window and inserts no rows', async () => {
      const past = new Date(Date.now() - 3 * 86_400_000);
      const { data: ev } = await svc
        .from('events')
        .insert({
          google_event_id: 'test-att-stale',
          title: 'Att Stale',
          start_at: past.toISOString(),
          end_at: new Date(past.getTime() + 60 * 60_000).toISOString(),
          is_counted: true,
        })
        .select('id')
        .single();
      const eventId = (ev as { id: string }).id;

      const { data: people } = await svc
        .from('persons')
        .select('id')
        .is('deleted_at', null)
        .limit(1);
      const personId = (people as { id: string }[])[0].id;

      const { error } = await servant.rpc('mark_attendance', {
        p_event_id: eventId,
        p_person_ids: [personId],
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/edit_window_closed/i);

      const { data: rows } = await svc.from('attendance').select('id').eq('event_id', eventId);
      expect((rows ?? []).length).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // 7.4 unmark_attendance deletes only the targeted rows
  // -------------------------------------------------------------------
  describe('unmark_attendance', () => {
    let svc: SupabaseClient;
    let servant: SupabaseClient;

    beforeAll(async () => {
      svc = adminClient();
      servant = await signInAs('servant1@stminaconnect.com');
      await clearTestEvents(svc);
    });

    afterAll(async () => {
      await clearTestEvents(svc);
    });

    it('deletes only the supplied person_ids', async () => {
      const { data: ev } = await svc
        .from('events')
        .insert({
          google_event_id: 'test-att-unmark',
          title: 'Att Unmark',
          start_at: new Date().toISOString(),
          end_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          is_counted: true,
        })
        .select('id')
        .single();
      const eventId = (ev as { id: string }).id;

      const { data: people } = await svc
        .from('persons')
        .select('id')
        .is('deleted_at', null)
        .limit(3);
      const ids = (people as { id: string }[]).map((p) => p.id);

      await servant.rpc('mark_attendance', { p_event_id: eventId, p_person_ids: ids });

      // Remove only the first id; the other two must remain.
      await servant.rpc('unmark_attendance', {
        p_event_id: eventId,
        p_person_ids: [ids[0]],
      });

      const { data: rows } = await svc
        .from('attendance')
        .select('person_id')
        .eq('event_id', eventId);
      const remaining = (rows as { person_id: string }[]).map((r) => r.person_id).sort();
      expect(remaining).toEqual([ids[1], ids[2]].sort());
    });
  });

  // -------------------------------------------------------------------
  // 7.5 search_persons projection / limit / soft-delete filter
  // -------------------------------------------------------------------
  describe('search_persons', () => {
    let servant: SupabaseClient;

    beforeAll(async () => {
      servant = await signInAs('servant1@stminaconnect.com');
    });

    it('returns at most 25 rows', async () => {
      // Single-character ILIKE matches a large slice of the seed; cap
      // is enforced server-side at 25.
      const { data, error } = await servant.rpc('search_persons', { query: 'a' });
      expect(error).toBeNull();
      expect((data as unknown[]).length).toBeLessThanOrEqual(25);
    });

    it('returns nothing for empty / whitespace-only queries', async () => {
      const { data: empty } = await servant.rpc('search_persons', { query: '' });
      expect((empty ?? []) as unknown[]).toEqual([]);
      const { data: ws } = await servant.rpc('search_persons', { query: '   ' });
      expect((ws ?? []) as unknown[]).toEqual([]);
    });

    it('does not return soft-deleted persons', async () => {
      const svc = adminClient();
      // Pick someone we can soft-delete then restore.
      const { data: list } = await svc
        .from('persons')
        .select('id, first_name, last_name')
        .is('deleted_at', null)
        .ilike('first_name', 'M%')
        .limit(1)
        .single();
      const target = list as { id: string; first_name: string; last_name: string };

      // Soft-delete via the RPC (admin only).
      const admin = await signInAs('priest@stminaconnect.com');
      await admin.rpc('soft_delete_person', { person_id: target.id });

      try {
        const { data } = await servant.rpc('search_persons', {
          query: target.last_name,
        });
        const ids = (data as { id: string }[]).map((r) => r.id);
        expect(ids).not.toContain(target.id);
      } finally {
        // Restore so subsequent runs see the seed unchanged. soft_delete_person
        // also scrubbed first/last_name, so we rewrite them here.
        await svc
          .from('persons')
          .update({
            deleted_at: null,
            first_name: target.first_name,
            last_name: target.last_name,
          })
          .eq('id', target.id);
      }
    });
  });
});
