/**
 * Mobile-side wrappers around the person RPCs declared in
 * `supabase/migrations/004_person_rpcs.sql`. Screens import from here
 * rather than calling `supabase.rpc(...)` or `supabase.from('persons')`
 * directly — that keeps the RLS-deny + RPC-only pattern enforceable.
 */
import type {
  Person,
  PersonCreatePayload,
  PersonUpdatePayload,
  PersonsFilter,
} from '@/types/person';

import { supabase } from './supabase';

export async function listPersons(filter: PersonsFilter = {}): Promise<Person[]> {
  const { data, error } = await supabase.rpc('list_persons', { filter });
  if (error) throw error;
  return (data ?? []) as Person[];
}

export async function getPerson(id: string): Promise<Person | null> {
  const { data, error } = await supabase.rpc('get_person', { person_id: id });
  if (error) throw error;
  // Same caveat as `fetchMyServant`: PostgREST sometimes returns a
  // record with all-null fields for a NULL composite-type result.
  const row = data as Person | null;
  if (!row || row.id == null) return null;
  return row;
}

export async function createPerson(payload: PersonCreatePayload): Promise<string> {
  const { data, error } = await supabase.rpc('create_person', { payload });
  if (error) throw error;
  return data as string;
}

export async function updatePerson(id: string, payload: PersonUpdatePayload): Promise<Person> {
  const { data, error } = await supabase.rpc('update_person', { person_id: id, payload });
  if (error) throw error;
  return data as Person;
}

export async function assignPerson(id: string, servantId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('assign_person', {
    person_id: id,
    servant_id: servantId,
    reason,
  });
  if (error) throw error;
}

export async function softDeletePerson(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_person', { person_id: id });
  if (error) throw error;
}
