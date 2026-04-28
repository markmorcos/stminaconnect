/**
 * Type shapes for the compliance capability — consent, data export, and
 * audit log. Mirrors `public.consent_log`, `public.audit_log`, and the
 * JSON envelopes returned by `export_my_data` / `export_person_data`.
 */

export interface ConsentLogRow {
  id: string;
  user_id: string;
  policy_version: string;
  terms_version: string;
  accepted_at: string;
  revoked_at: string | null;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogFilter {
  actor_id?: string;
  action?: string;
  /** ISO timestamp; rows with `created_at >= since` are included. */
  since?: string;
  /** ISO timestamp; rows with `created_at < until` are included. */
  until?: string;
  limit?: number;
  offset?: number;
}

export interface SelfExportEnvelope {
  exported_at: string;
  user_id: string;
  auth_user: { id: string; email: string | null; created_at: string } | null;
  servant: Record<string, unknown> | null;
  consent_log: ConsentLogRow[];
  notifications: Record<string, unknown>[];
  follow_ups_created: Record<string, unknown>[];
}

export interface PersonExportEnvelope {
  exported_at: string;
  person_id: string;
  person: Record<string, unknown> | null;
  attendance: Record<string, unknown>[];
  follow_ups: Record<string, unknown>[];
  assignment_history: Record<string, unknown>[];
  absence_alerts: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
}

/** UUID for the sentinel "Erased Servant" row. Kept in sync with migration 035. */
export const ERASED_SERVANT_ID = '00000000-0000-0000-0000-000000000000' as const;
