import { supabase } from './supabase';

/**
 * Shape of the `public.servants` row returned by the `get_my_servant` RPC.
 * Mirrors columns 1:1 — keep in sync with `supabase/migrations/001_servants.sql`.
 */
export interface ServantRow {
  id: string;
  email: string;
  display_name: string | null;
  role: 'admin' | 'servant';
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
}

/**
 * Fetches the calling user's servant row via the security-definer RPC.
 * Returns null when the auth user has no matching servant row — the auth
 * store treats that as an account-not-configured failure and signs out.
 */
export async function fetchMyServant(): Promise<ServantRow | null> {
  const { data, error } = await supabase.rpc('get_my_servant');
  if (error) throw error;
  // PostgREST sometimes returns a record with all-null fields rather
  // than JSON null when a function returning a composite type matches
  // no rows. Treat a missing `id` as the null case so callers don't
  // have to know which path Supabase took.
  const row = data as ServantRow | null;
  if (!row || row.id == null) return null;
  return row;
}

/**
 * Lists active servants. Returns an empty array for non-admins (the RPC
 * gates on `is_admin()` server-side).
 */
export async function listServants(): Promise<ServantRow[]> {
  const { data, error } = await supabase.rpc('list_servants');
  if (error) throw error;
  return (data ?? []) as ServantRow[];
}

export interface ServantUpdatePayload {
  display_name?: string;
}

export class AdminOnlyError extends Error {
  constructor() {
    super('admin only');
    this.name = 'AdminOnlyError';
  }
}

/**
 * Admin-only update of another servant's row. Surfaces `AdminOnlyError`
 * for the well-known server-side reject so callers can map it to a
 * localized message.
 */
export async function updateServant(
  servantId: string,
  payload: ServantUpdatePayload,
): Promise<ServantRow> {
  const { data, error } = await supabase.rpc('update_servant', {
    servant_id: servantId,
    payload,
  });
  if (error) {
    if ((error.message ?? '').toLowerCase().includes('admin only')) {
      throw new AdminOnlyError();
    }
    throw error;
  }
  return data as ServantRow;
}
