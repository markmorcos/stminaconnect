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
