/**
 * Maps a notification (type + payload) to a deep-link route string.
 *
 *   - `system`         → /notifications (default inbox).
 *   - `absence_alert`  → /persons/[personId]?openFollowUp=true so the
 *                        recipient lands on the profile with the
 *                        follow-up modal pre-opened (added by
 *                        add-followups-and-on-break).
 *   - `welcome_back`   → /persons/[personId] — closes the loop after
 *                        the alerted person attends a counted event.
 *   - `reassignment`   → not yet routed.
 */
import type { NotificationType } from './types';

export function notificationRouter(
  type: NotificationType,
  payload: Record<string, unknown> | undefined,
): string | null {
  const personId = typeof payload?.personId === 'string' ? (payload.personId as string) : null;
  switch (type) {
    case 'system':
      return '/notifications';
    case 'absence_alert':
      return personId ? `/persons/${personId}?openFollowUp=true` : '/notifications';
    case 'welcome_back':
      return personId ? `/persons/${personId}` : '/notifications';
    case 'reassignment':
    default:
      return null;
  }
}
