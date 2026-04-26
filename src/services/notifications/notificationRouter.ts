/**
 * Maps a notification (type + payload) to a deep-link route string.
 *
 * Phase 7 only wires the `system` type — it routes to the inbox screen so
 * the "View" button in the banner has a sensible default. Later phases
 * extend this map (absence_alert → person profile, etc.). When no route
 * is defined we return null and the UI no-ops on tap.
 */
import type { NotificationType } from './types';

export function notificationRouter(
  type: NotificationType,
  // payload is intentionally unused for now — later phases narrow on type
  // and read fields like `payload.person_id` to build per-type routes.
  _payload: Record<string, unknown> | undefined,
): string | null {
  switch (type) {
    case 'system':
      return '/notifications';
    case 'absence_alert':
    case 'welcome_back':
    case 'reassignment':
    default:
      return null;
  }
}
