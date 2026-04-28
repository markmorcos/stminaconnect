/**
 * Expo Push API client (single-batch). For our scale (a parish; rarely
 * more than a couple of hundred active tokens) one POST per dispatch is
 * fine — `https://exp.host/--/api/v2/push/send` accepts up to 100
 * messages in a batch.
 *
 * We surface immediate ticket errors only; receipt polling (the second
 * round-trip via `/push/getReceipts`) is deferred. The single error
 * code we act on right now is `DeviceNotRegistered`, which Expo also
 * returns synchronously on the ticket so the immediate response is
 * enough for token cleanup.
 */

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** "default" or "high" — Expo's terminology, mapped to APNs/FCM at their end. */
  priority?: 'default' | 'high';
  channelId?: string;
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Pairs each input message with its corresponding ticket so callers
 * can map errors back to the offending token.
 */
export interface ExpoSendResult {
  message: ExpoPushMessage;
  ticket: ExpoTicket;
}

export interface ExpoPushClient {
  send(messages: ExpoPushMessage[]): Promise<ExpoSendResult[]>;
}

/**
 * Default client backed by `globalThis.fetch`. Inject a fake in tests
 * to avoid real network traffic.
 */
export function createExpoPushClient(
  fetchImpl: typeof fetch = fetch,
  endpoint: string = EXPO_PUSH_ENDPOINT,
): ExpoPushClient {
  return {
    async send(messages) {
      if (messages.length === 0) return [];

      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        // Synthesize per-message error tickets so the caller can decide
        // what to do (retry, mark token bad, etc). HTTP-level failures
        // are NOT DeviceNotRegistered — leave tokens alone.
        const text = await res.text().catch(() => res.statusText);
        return messages.map((m) => ({
          message: m,
          ticket: {
            status: 'error' as const,
            message: `expo push http ${res.status}: ${text.slice(0, 200)}`,
          },
        }));
      }

      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = Array.isArray(json.data) ? json.data : [];

      // Expo guarantees order parity with the request; pad if short.
      return messages.map((m, i) => ({
        message: m,
        ticket:
          tickets[i] ??
          ({
            status: 'error',
            message: 'missing ticket from expo push response',
          } as ExpoTicket),
      }));
    },
  };
}

/** True when Expo's response indicates the token belongs to an
 * uninstalled / token-revoked device and should be deactivated. */
export function isDeviceNotRegistered(ticket: ExpoTicket): boolean {
  if (ticket.status !== 'error') return false;
  return ticket.details?.error === 'DeviceNotRegistered';
}
