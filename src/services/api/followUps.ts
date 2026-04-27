/**
 * Follow-ups API.
 *
 * Online-only (no local SQLite mirror) — follow-up logging is a
 * relatively low-volume action and the spec does not require offline
 * support. Reads call `list_follow_ups_pending` directly; writes call
 * `create_follow_up` / `update_follow_up`. TanStack Query handles
 * caching + invalidation in the screens.
 */
import { supabase } from './supabase';

export type FollowUpAction = 'called' | 'texted' | 'visited' | 'no_answer' | 'other';
export type FollowUpStatus = 'completed' | 'snoozed';

export interface FollowUpRow {
  id: string;
  person_id: string;
  created_by: string;
  action: FollowUpAction;
  notes: string | null;
  status: FollowUpStatus;
  snooze_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFollowUpInput {
  person_id: string;
  action: FollowUpAction;
  notes?: string | null;
  status: FollowUpStatus;
  snooze_until?: string | null;
}

export interface UpdateFollowUpInput {
  action?: FollowUpAction;
  notes?: string | null;
  status?: FollowUpStatus;
  snooze_until?: string | null;
}

export type PendingSection = 'needs_follow_up' | 'snoozed_returning' | 'recent';

export interface PendingRow {
  section: PendingSection;
  follow_up_id: string | null;
  alert_id: string | null;
  person_id: string;
  person_first: string;
  person_last: string;
  person_priority: 'high' | 'medium' | 'low' | 'very_low';
  action: FollowUpAction | null;
  notes: string | null;
  status: FollowUpStatus | null;
  snooze_until: string | null;
  created_at: string;
  alert_streak: number | null;
  alert_crossed_at: string | null;
}

export async function createFollowUp(input: CreateFollowUpInput): Promise<FollowUpRow> {
  const { data, error } = await supabase.rpc('create_follow_up', {
    payload: input,
  });
  if (error) throw error;
  return data as FollowUpRow;
}

export async function updateFollowUp(id: string, input: UpdateFollowUpInput): Promise<FollowUpRow> {
  const { data, error } = await supabase.rpc('update_follow_up', {
    p_id: id,
    payload: input,
  });
  if (error) throw error;
  return data as FollowUpRow;
}

export async function listPendingFollowUps(servantId?: string): Promise<PendingRow[]> {
  const { data, error } = await supabase.rpc('list_follow_ups_pending', {
    p_servant_id: servantId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as PendingRow[];
}
