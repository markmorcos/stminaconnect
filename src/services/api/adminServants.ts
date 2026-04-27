/**
 * Admin-only servant management — invites a new servant via the
 * `invite-servant` Edge Function and wraps the lifecycle RPCs in
 * 028_admin_servant_rpcs.sql (role change, deactivate, reactivate).
 */
import { supabase } from './supabase';
import type { ServantRow } from './servants';

export interface InviteServantPayload {
  email: string;
  displayName?: string;
  role?: 'admin' | 'servant';
  /**
   * Where the magic-link in the invite email should land. Computed at
   * call time via `Linking.createURL('/auth/callback')` so the URL has
   * the right scheme for the runtime: `exp://<lan-ip>:8081/--/auth/callback`
   * in Expo Go, `stminaconnect://auth/callback` in dev/prod builds.
   * The Edge Function forwards this verbatim to Supabase Auth.
   */
  redirectTo?: string;
}

export class AdminInviteError extends Error {
  constructor(
    public readonly code:
      | 'invalid_email'
      | 'invalid_role'
      | 'invalid_body'
      | 'invalid_json'
      | 'forbidden'
      | 'unauthorized'
      | 'already_registered'
      | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'AdminInviteError';
  }
}

interface InviteResponseSuccess {
  servant: ServantRow;
}

interface InviteResponseError {
  error: string;
}

type InviteResponse = InviteResponseSuccess | InviteResponseError;

export async function inviteServant(payload: InviteServantPayload): Promise<ServantRow> {
  const { data, error } = await supabase.functions.invoke<InviteResponse>('invite-servant', {
    body: payload,
  });
  if (error) {
    // Edge Function 4xx/5xx surfaces here; data may carry the JSON body.
    const code = (data as InviteResponseError | undefined)?.error;
    throw mapInviteError(code, error.message);
  }
  if (!data || 'error' in data) {
    throw mapInviteError(data?.error, 'invite failed');
  }
  return data.servant;
}

function mapInviteError(code: string | undefined, fallback: string): AdminInviteError {
  switch (code) {
    case 'invalid_email':
    case 'invalid_role':
    case 'invalid_body':
    case 'invalid_json':
    case 'forbidden':
    case 'unauthorized':
      return new AdminInviteError(code, fallback);
    default:
      if (code && /already.*registered|exists/i.test(code)) {
        return new AdminInviteError('already_registered', code);
      }
      return new AdminInviteError('unknown', code ?? fallback);
  }
}

export async function listAllServants(): Promise<ServantRow[]> {
  const { data, error } = await supabase.rpc('list_all_servants');
  if (error) throw error;
  return (data ?? []) as ServantRow[];
}

export async function updateServantRole(
  servantId: string,
  role: 'admin' | 'servant',
): Promise<ServantRow> {
  const { data, error } = await supabase.rpc('update_servant_role', {
    p_servant_id: servantId,
    p_role: role,
  });
  if (error) throw error;
  return data as ServantRow;
}

export async function deactivateServant(servantId: string): Promise<ServantRow> {
  const { data, error } = await supabase.rpc('deactivate_servant', {
    p_servant_id: servantId,
  });
  if (error) throw error;
  return data as ServantRow;
}

export async function reactivateServant(servantId: string): Promise<ServantRow> {
  const { data, error } = await supabase.rpc('reactivate_servant', {
    p_servant_id: servantId,
  });
  if (error) throw error;
  return data as ServantRow;
}
