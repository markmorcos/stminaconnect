import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';

import { dispatch, type DispatchOutcome } from './index.ts';
import type { ExpoPushClient, ExpoSendResult } from './expoPush.ts';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

interface FakeRow {
  notification?: {
    id: string;
    recipient_servant_id: string;
    type: 'absence_alert' | 'welcome_back' | 'reassignment' | 'system';
    payload: Record<string, unknown>;
  };
  servant?: {
    id: string;
    language: string;
    quiet_hours_enabled: boolean;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
  };
  tokens?: Array<{ id: string; token: string; deactivated_at?: string | null }>;
}

interface FakeDbState {
  rows: FakeRow;
  /** Tokens deactivated by `update({deactivated_at})` calls. */
  deactivatedTokenIds: string[];
}

function makeFakeDb(state: FakeDbState) {
  const fakeFrom = (table: string) => {
    if (table === 'notifications') {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => ({
              data: state.rows.notification ?? null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'servants') {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => ({
              data: state.rows.servant ?? null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'expo_push_tokens') {
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            is: (_col2: string, _val2: null) =>
              Promise.resolve({
                data: (state.rows.tokens ?? []).filter((t) => !t.deactivated_at),
                error: null,
              }),
          }),
        }),
        update: (_patch: Record<string, unknown>) => ({
          eq: async (_col: string, val: string) => {
            state.deactivatedTokenIds.push(val);
            return { data: null, error: null };
          },
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  };
  // deno-lint-ignore no-explicit-any
  return { from: fakeFrom } as any;
}

function makeFakeExpo(tickets: ExpoSendResult['ticket'][]): ExpoPushClient {
  return {
    send: async (messages) =>
      messages.map((m, i) => ({
        message: m,
        ticket: tickets[i] ?? { status: 'ok', id: `ticket-${i}` },
      })),
  };
}

// ---------------------------------------------------------------------------
// 6.3 — quiet hours skips Expo POST but in-app row is unaffected
// ---------------------------------------------------------------------------

Deno.test('within quiet hours: no expo POST, no token deactivation', async () => {
  let expoCalled = 0;
  const expo: ExpoPushClient = {
    send: async () => {
      expoCalled++;
      return [];
    },
  };

  const state: FakeDbState = {
    rows: {
      notification: {
        id: 'n1',
        recipient_servant_id: 's1',
        type: 'absence_alert',
        payload: { personName: 'Mina', consecutiveMisses: 3, lastEventTitle: 'Lobpreis' },
      },
      servant: {
        id: 's1',
        language: 'en',
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '07:00:00',
      },
      tokens: [{ id: 't1', token: 'ExponentPushToken[abc]' }],
    },
    deactivatedTokenIds: [],
  };

  const result: DispatchOutcome = await dispatch('n1', {
    db: makeFakeDb(state),
    expo,
    now: () => berlinTime('2026-01-15', 23, 30),
  });

  assertEquals(result.outcome, 'quiet_hours');
  assertEquals(expoCalled, 0);
  assertEquals(state.deactivatedTokenIds.length, 0);
});

// ---------------------------------------------------------------------------
// 6.4 — DeviceNotRegistered receipt deactivates the offending token
// ---------------------------------------------------------------------------

Deno.test('DeviceNotRegistered receipt deactivates that token', async () => {
  const state: FakeDbState = {
    rows: {
      notification: {
        id: 'n2',
        recipient_servant_id: 's2',
        type: 'welcome_back',
        payload: { personName: 'Anna', eventTitle: 'Gebetsabend' },
      },
      servant: {
        id: 's2',
        language: 'de',
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
      },
      tokens: [
        { id: 'tA', token: 'ExponentPushToken[A]' },
        { id: 'tB', token: 'ExponentPushToken[B]' },
      ],
    },
    deactivatedTokenIds: [],
  };

  const expo = makeFakeExpo([
    { status: 'ok', id: 'ok-1' },
    { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
  ]);

  const result = await dispatch('n2', {
    db: makeFakeDb(state),
    expo,
    now: () => berlinTime('2026-01-15', 14, 0),
  });

  assertEquals(result.outcome, 'sent');
  assertEquals(result.attempted, 2);
  assertEquals(result.errors, 1);
  assertEquals(result.deactivated, 1);
  assertEquals(state.deactivatedTokenIds, ['tB']);
});

// ---------------------------------------------------------------------------
// Coverage: no tokens / no recipient / not_found
// ---------------------------------------------------------------------------

Deno.test('no active tokens: outcome=no_tokens', async () => {
  const result = await dispatch('n3', {
    db: makeFakeDb({
      rows: {
        notification: {
          id: 'n3',
          recipient_servant_id: 's3',
          type: 'system',
          payload: { message: 'hi' },
        },
        servant: {
          id: 's3',
          language: 'en',
          quiet_hours_enabled: false,
          quiet_hours_start: null,
          quiet_hours_end: null,
        },
        tokens: [],
      },
      deactivatedTokenIds: [],
    }),
    expo: makeFakeExpo([]),
    now: () => berlinTime('2026-01-15', 14, 0),
  });
  assertEquals(result.outcome, 'no_tokens');
});

Deno.test('notification id not found: outcome=not_found', async () => {
  const result = await dispatch('missing', {
    db: makeFakeDb({ rows: {}, deactivatedTokenIds: [] }),
    expo: makeFakeExpo([]),
  });
  assertEquals(result.outcome, 'not_found');
});

// ---------------------------------------------------------------------------
// Helper: build a UTC Date that, in Berlin, falls at the given (h, m)
// ---------------------------------------------------------------------------

function berlinTime(yyyymmdd: string, h: number, m: number): Date {
  const utcRef = new Date(`${yyyymmdd}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(utcRef);
  const berlinH = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
  const offsetHours = berlinH - 12;
  const wrapped = (((h - offsetHours) % 24) + 24) % 24;
  return new Date(
    `${yyyymmdd}T${String(wrapped).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`,
  );
}
