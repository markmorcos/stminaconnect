/**
 * Notification type taxonomy and row mapping helpers.
 *
 * Producers for `absence_alert`, `welcome_back`, and `reassignment` land
 * in later phases — the payload shapes are defined now so the service
 * contract is stable. The discriminated union is keyed by `type`.
 */

export type NotificationType = 'absence_alert' | 'welcome_back' | 'reassignment' | 'system';

export interface AbsenceAlertPayload {
  /** Person whose absence triggered the alert. Populated in phase 11. */
  person_id: string;
  /** ISO date of the most recent attendance. */
  last_seen_at?: string;
}

export interface WelcomeBackPayload {
  /** Person who returned after an absence. Populated in phase 12. */
  person_id: string;
}

export interface ReassignmentPayload {
  /** Person who has been re-assigned to the recipient. */
  person_id: string;
  /** Servant the person was re-assigned away from. */
  previous_servant_id?: string;
  /** Reason captured at reassignment time. */
  reason?: string;
}

export interface SystemPayload {
  /** Free-form text body — used by phase-7 verification scripts. */
  message?: string;
}

export type NotificationPayloadFor<T extends NotificationType> = T extends 'absence_alert'
  ? AbsenceAlertPayload
  : T extends 'welcome_back'
    ? WelcomeBackPayload
    : T extends 'reassignment'
      ? ReassignmentPayload
      : T extends 'system'
        ? SystemPayload
        : never;

interface NotificationBase<T extends NotificationType> {
  id: string;
  type: T;
  payload: NotificationPayloadFor<T>;
  recipientServantId: string;
  createdAt: string;
  readAt: string | null;
}

export type Notification =
  | NotificationBase<'absence_alert'>
  | NotificationBase<'welcome_back'>
  | NotificationBase<'reassignment'>
  | NotificationBase<'system'>;

/**
 * Snake-cased shape returned by the `notifications` table / Realtime
 * insert events. Mirrors the SQL columns 1:1.
 */
export interface NotificationRow {
  id: string;
  recipient_servant_id: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

/** Maps a row from the server into the camelCased client shape. */
export function notificationFromRow(row: NotificationRow): Notification {
  const payload = (row.payload ?? {}) as Notification['payload'];
  return {
    id: row.id,
    type: row.type,
    payload,
    recipientServantId: row.recipient_servant_id,
    createdAt: row.created_at,
    readAt: row.read_at,
  } as Notification;
}
