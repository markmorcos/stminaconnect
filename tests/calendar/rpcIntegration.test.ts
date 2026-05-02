/**
 * Integration tests for the calendar capability RPCs.
 *
 *  - `match_counted_event` substring & case-insensitivity (9.2)
 *  - `upsert_counted_event_pattern` recomputes `events.is_counted` (9.3)
 *  - `get_today_events` honours Europe/Berlin day boundary (9.4)
 *  - `trigger_calendar_sync` rate limit blocks within 60s (9.5)
 *
 * Gated on RUN_INTEGRATION_TESTS=1 — needs a running Supabase stack
 * with all migrations applied + seed.sql loaded (priest@stminaconnect.com is
 * the admin used here). Bypassed otherwise so the unit suite stays
 * green offline.
 *
 * Mutations to `events` and `counted_event_patterns` happen via the
 * service-role client; reads/RPC calls happen through admin-signed-in
 * sessions. Each test cleans up after itself so re-runs are idempotent.
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
  await svc.from('events').delete().like('google_event_id', 'test-%');
}

async function clearTestPatterns(svc: SupabaseClient): Promise<void> {
  await svc.from('counted_event_patterns').delete().in('pattern', ['Liturgy', 'Bible', 'Vespers']);
}

async function clearRecentSyncLog(svc: SupabaseClient): Promise<void> {
  // Wipe rows newer than 2 minutes ago so the rate-limit test starts
  // from a known-empty state.
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  await svc.from('sync_log').delete().gte('started_at', cutoff);
}

describeIntegration('calendar RPCs (live Supabase)', () => {
  // ----------------------------------------------------------------
  // 9.2 match_counted_event
  // ----------------------------------------------------------------
  describe('match_counted_event', () => {
    let svc: SupabaseClient;
    let admin: SupabaseClient;

    beforeAll(async () => {
      svc = adminClient();
      admin = await signInAs('priest@stminaconnect.com');
      await clearTestPatterns(svc);
      await svc.from('counted_event_patterns').insert({ pattern: 'Liturgy' });
    });

    afterAll(async () => {
      await clearTestPatterns(svc);
    });

    it('returns true for substring matches', async () => {
      const { data, error } = await admin.rpc('match_counted_event', { title: 'Sunday Liturgy' });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    it('returns false when no pattern matches', async () => {
      const { data, error } = await admin.rpc('match_counted_event', { title: 'Choir Practice' });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('is case-insensitive', async () => {
      const { data, error } = await admin.rpc('match_counted_event', {
        title: 'Holy Week LITURGY',
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 9.3 upsert_counted_event_pattern recomputes is_counted in window
  // ----------------------------------------------------------------
  describe('upsert_counted_event_pattern', () => {
    let svc: SupabaseClient;
    let admin: SupabaseClient;

    beforeAll(async () => {
      svc = adminClient();
      admin = await signInAs('priest@stminaconnect.com');
      await clearTestPatterns(svc);
      await clearTestEvents(svc);

      // Seed three events in the rolling window (all is_counted=false).
      const now = new Date();
      const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
      await svc.from('events').insert([
        {
          google_event_id: 'test-liturgy',
          title: 'Sunday Liturgy 2026-04-26',
          start_at: inDays(2),
          end_at: inDays(2),
          is_counted: false,
        },
        {
          google_event_id: 'test-bible',
          title: 'Bible Study 2026-04-29',
          start_at: inDays(5),
          end_at: inDays(5),
          is_counted: false,
        },
        {
          google_event_id: 'test-choir',
          title: 'Choir Practice 2026-04-28',
          start_at: inDays(4),
          end_at: inDays(4),
          is_counted: false,
        },
      ]);
    });

    afterAll(async () => {
      await clearTestEvents(svc);
      await clearTestPatterns(svc);
    });

    it('flips is_counted=true on matching events when a pattern is added', async () => {
      const { error: rpcErr } = await admin.rpc('upsert_counted_event_pattern', {
        new_pattern: 'Liturgy',
      });
      expect(rpcErr).toBeNull();

      const { data: rows } = await svc
        .from('events')
        .select('google_event_id, is_counted')
        .like('google_event_id', 'test-%');
      const byId = Object.fromEntries((rows ?? []).map((r) => [r.google_event_id, r.is_counted]));
      expect(byId['test-liturgy']).toBe(true);
      expect(byId['test-bible']).toBe(false);
      expect(byId['test-choir']).toBe(false);
    });

    it('flips is_counted=false when the only matching pattern is removed', async () => {
      // Add 'Bible' so test-bible flips true, then remove it.
      await admin.rpc('upsert_counted_event_pattern', { new_pattern: 'Bible' });

      const { data: pats } = await svc
        .from('counted_event_patterns')
        .select('id, pattern')
        .eq('pattern', 'Bible')
        .single();
      expect(pats).not.toBeNull();
      const bibleId = (pats as { id: string }).id;

      await admin.rpc('delete_counted_event_pattern', { pattern_id: bibleId });

      const { data: row } = await svc
        .from('events')
        .select('is_counted')
        .eq('google_event_id', 'test-bible')
        .single();
      expect((row as { is_counted: boolean }).is_counted).toBe(false);
    });

    it('rejects non-admin upsert', async () => {
      const servant = await signInAs('servant1@stminaconnect.com');
      const { error } = await servant.rpc('upsert_counted_event_pattern', {
        new_pattern: 'Vespers',
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/admin only/i);
    });
  });

  // ----------------------------------------------------------------
  // 9.4 get_today_events honours Berlin day boundary
  // ----------------------------------------------------------------
  describe('get_today_events', () => {
    let svc: SupabaseClient;
    let admin: SupabaseClient;

    beforeAll(async () => {
      svc = adminClient();
      admin = await signInAs('priest@stminaconnect.com');
      await clearTestEvents(svc);

      // Build a `start_at` that lands on "today" in Berlin but is the
      // *previous* day in UTC. We compute relative to now() so the test
      // is robust across DST without hard-coding a date.
      const now = new Date();
      const berlinNoonToday = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      // 00:30 Berlin local on today's date — this is yesterday or today UTC
      // depending on the offset, but always today in Berlin.
      const y = berlinNoonToday.getFullYear();

      // Berlin offset in minutes for this instant (positive east of UTC).
      // Computed by diffing en-GB and UTC formatted strings.
      const offsetMinutes = (() => {
        const local = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        return Math.round((local.getTime() - utc.getTime()) / 60_000);
      })();

      // 00:30 Berlin local → UTC = 00:30 - offset.
      const startUtc = new Date(
        Date.UTC(y, berlinNoonToday.getMonth(), berlinNoonToday.getDate(), 0, 30) -
          offsetMinutes * 60_000,
      );
      const endUtc = new Date(startUtc.getTime() + 60 * 60_000);

      await svc.from('events').insert({
        google_event_id: 'test-berlin-today',
        title: 'Berlin Boundary Test',
        start_at: startUtc.toISOString(),
        end_at: endUtc.toISOString(),
        is_counted: false,
      });
    });

    afterAll(async () => {
      await clearTestEvents(svc);
    });

    it('returns events whose Berlin-local day is today, even if UTC is yesterday', async () => {
      const { data, error } = await admin.rpc('get_today_events');
      expect(error).toBeNull();
      const titles = (data as { title: string }[]).map((r) => r.title);
      expect(titles).toContain('Berlin Boundary Test');
    });
  });

  // ----------------------------------------------------------------
  // 9.5 trigger_calendar_sync rate limit
  // ----------------------------------------------------------------
  describe('trigger_calendar_sync rate limit', () => {
    let svc: SupabaseClient;
    let admin: SupabaseClient;

    beforeAll(async () => {
      svc = adminClient();
      admin = await signInAs('priest@stminaconnect.com');
      await clearRecentSyncLog(svc);
    });

    afterAll(async () => {
      await clearRecentSyncLog(svc);
    });

    it('rejects a second call within 60s of the first', async () => {
      // Stand in for an in-flight or recently-completed sync by
      // inserting a sync_log row directly. trigger_calendar_sync's
      // rate-limit check counts ANY sync_log row within the last
      // minute, so this exercises the same code path as a real
      // back-to-back call without depending on pg_net's network call
      // succeeding (which requires the full Vault setup).
      await svc
        .from('sync_log')
        .insert({ outcome: 'success', finished_at: new Date().toISOString() });

      const { error } = await admin.rpc('trigger_calendar_sync');
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/rate_limited/i);
    });

    it('rejects non-admin callers regardless of rate-limit state', async () => {
      const servant = await signInAs('servant1@stminaconnect.com');
      const { error } = await servant.rpc('trigger_calendar_sync');
      expect(error).not.toBeNull();
      expect(error?.message ?? '').toMatch(/admin only/i);
    });
  });
});
