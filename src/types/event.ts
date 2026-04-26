/**
 * Type shapes mirroring tables introduced by the
 * `add-google-calendar-sync` change (migrations 009..014).
 *
 * Keep in sync with the SQL schema; the RPCs in
 * `services/api/events.ts` project these out of `supabase.rpc(...)`.
 */

export interface CalendarEvent {
  id: string;
  google_event_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_counted: boolean;
  synced_at: string;
}

export interface CountedEventPattern {
  id: string;
  pattern: string;
  created_by: string | null;
  created_at: string;
}

export type SyncOutcome = 'running' | 'success' | 'error';

export interface SyncLogRow {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  outcome: SyncOutcome;
  error: string | null;
  upserted: number | null;
  deleted: number | null;
}

export interface TriggerSyncResult {
  request_id: number;
  outcome: 'queued';
}
