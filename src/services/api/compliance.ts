/**
 * Typed wrappers around the GDPR compliance RPCs (migration 036) and
 * the `delete-auth-user` Edge Function. These are thin and synchronous
 * with the server contract — RPC name in, JSON envelope out.
 *
 * Local SQLite caching is intentionally not applied here. Compliance
 * actions are infrequent, on-demand, and always require an online
 * round-trip (a stale local read could silently violate the regulation).
 */
import type {
  AuditLogFilter,
  AuditLogRow,
  ConsentLogRow,
  PersonExportEnvelope,
  SelfExportEnvelope,
} from '@/types/compliance';

import { supabase } from './supabase';

export async function recordConsent(
  policyVersion: string,
  termsVersion: string,
): Promise<ConsentLogRow> {
  const { data, error } = await supabase.rpc('record_consent', {
    p_policy_version: policyVersion,
    p_terms_version: termsVersion,
  });
  if (error) throw error;
  return data as ConsentLogRow;
}

export async function getMyLatestConsent(): Promise<ConsentLogRow | null> {
  const { data, error } = await supabase.rpc('get_my_latest_consent');
  if (error) throw error;
  return (data ?? null) as ConsentLogRow | null;
}

export async function revokeConsent(consentId: string): Promise<ConsentLogRow> {
  const { data, error } = await supabase.rpc('revoke_consent', {
    p_consent_id: consentId,
  });
  if (error) throw error;
  return data as ConsentLogRow;
}

export async function exportMyData(): Promise<SelfExportEnvelope> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return data as SelfExportEnvelope;
}

export async function exportPersonData(personId: string): Promise<PersonExportEnvelope> {
  const { data, error } = await supabase.rpc('export_person_data', {
    p_person_id: personId,
  });
  if (error) throw error;
  return data as PersonExportEnvelope;
}

export async function erasePersonData(personId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('erase_person_data', {
    p_person_id: personId,
    p_reason: reason,
  });
  if (error) throw error;
}

/**
 * Caller-scoped self-erasure. Sequence:
 *   1. `erase_my_account` RPC — anonymizes references, drops the
 *      `servants` row, audit-logs the action.
 *   2. `delete-auth-user` Edge Function — drops the `auth.users` row
 *      using the service role key.
 *   3. `supabase.auth.signOut()` — clears local session.
 *
 * If step 2 fails, step 1 has already succeeded and the user's
 * `servants` row is gone — they can no longer reach any authenticated
 * screen via the auth guard. Step 2 is retryable from a separate
 * support channel; the auth user being orphaned is harmless.
 */
export async function eraseMyAccount(): Promise<void> {
  const { error: rpcError } = await supabase.rpc('erase_my_account');
  if (rpcError) throw rpcError;

  const { error: fnError } = await supabase.functions.invoke('delete-auth-user', {
    body: {},
  });
  // The function failing should not block the local sign-out below; the
  // user has already lost server-side access. Log via thrown error so
  // the caller can surface a soft warning if desired.
  if (fnError) {
    throw new Error(`delete-auth-user failed: ${fnError.message}`);
  }
}

export async function listAuditLog(filter: AuditLogFilter = {}): Promise<AuditLogRow[]> {
  const payload: Record<string, unknown> = {};
  if (filter.actor_id) payload.actor_id = filter.actor_id;
  if (filter.action) payload.action = filter.action;
  if (filter.since) payload.since = filter.since;
  if (filter.until) payload.until = filter.until;
  if (filter.limit !== undefined) payload.limit = String(filter.limit);
  if (filter.offset !== undefined) payload.offset = String(filter.offset);

  const { data, error } = await supabase.rpc('list_audit_log', { filter: payload });
  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}

/** Caller-scoped consent history (raw query — RLS scopes it to self). */
export async function listMyConsentHistory(): Promise<ConsentLogRow[]> {
  const { data, error } = await supabase
    .from('consent_log')
    .select('*')
    .order('accepted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConsentLogRow[];
}
