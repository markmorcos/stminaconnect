/**
 * On-break API. Direct RPC calls for `mark_on_break` and `end_break`.
 * The local `persons` SQLite mirror picks up the new status / paused_until
 * via `sync_persons_since` on the next pull; we also write the change
 * locally for an immediately-correct profile view.
 *
 * Open-ended breaks are encoded as `paused_until = '9999-12-31'`
 * server-side; callers pass that string when the user picks the
 * "Open-ended" toggle.
 */
import { upsertPersons } from '@/services/db/repositories/personsRepo';
import type { Person } from '@/types/person';

import { supabase } from './supabase';

export const OPEN_ENDED_BREAK_DATE = '9999-12-31';

export async function markOnBreak(personId: string, pausedUntil: string): Promise<Person> {
  const { data, error } = await supabase.rpc('mark_on_break', {
    p_person_id: personId,
    p_paused_until: pausedUntil,
  });
  if (error) throw error;
  const row = data as Person;
  await upsertPersons([row], 'synced');
  return row;
}

export async function endBreak(personId: string): Promise<Person> {
  const { data, error } = await supabase.rpc('end_break', {
    p_person_id: personId,
  });
  if (error) throw error;
  const row = data as Person;
  await upsertPersons([row], 'synced');
  return row;
}
