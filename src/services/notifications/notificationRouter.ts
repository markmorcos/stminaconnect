/**
 * Maps a notification (type + payload) to a deep-link route string.
 *
 * `absence_alert` lands a recipient on the person's profile screen so
 * they can see context and start a follow-up. Phase 12 swaps this to the
 * follow-up creation flow.
 */
import type { NotificationType } from './types';

export function notificationRouter(
  type: NotificationType,
  payload: Record<string, unknown> | undefined,
): string | null {
  switch (type) {
    case 'system':
      return '/notifications';
    case 'absence_alert': {
      const personId = typeof payload?.personId === 'string' ? (payload.personId as string) : null;
      return personId ? `/persons/${personId}` : '/notifications';
    }
    case 'welcome_back':
    case 'reassignment':
    default:
      return null;
  }
}
