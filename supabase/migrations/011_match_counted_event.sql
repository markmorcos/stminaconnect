-- 011_match_counted_event.sql
-- `match_counted_event(title)` returns true when `title` contains any
-- configured `counted_event_patterns.pattern` as a case-insensitive
-- substring. Patterns are OR'd. Empty pattern table → returns false.
--
-- Used by:
--   * `sync-calendar-events` Edge Function on each upsert.
--   * `upsert_counted_event_pattern` / `delete_counted_event_pattern`
--     to recompute `events.is_counted` across the rolling window.
--
-- `stable` because for a given `(title, patterns-table-state)` the
-- result is deterministic within a transaction.

create or replace function public.match_counted_event(title text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.counted_event_patterns
    where title ilike '%' || pattern || '%'
  );
$$;

revoke execute on function public.match_counted_event(text) from public;
grant execute on function public.match_counted_event(text) to authenticated, service_role;
