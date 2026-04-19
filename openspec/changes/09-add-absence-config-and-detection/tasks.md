## 1. Schema

- [ ] 1.1 Migration `016_absence_config.sql`: `absence_config` table with a singleton constraint (id=1); columns `default_threshold int`, `admin_gets_alerts boolean`, `alert_priority_thresholds jsonb`; seed default row
- [ ] 1.2 Migration `017_absence_alerts.sql`: table per spec; indexes on `(assigned_servant_id, status)` and `(person_id, status)`
- [ ] 1.3 RLS: absence_config readable by all authenticated, writable by admin only. Absence_alerts readable by the person's assigned servant + admins; no direct writes (service-role only via RPC).
- [ ] 1.4 Integration tests for RLS

## 2. Algorithm

- [ ] 2.1 Migration `018_absence_rpcs.sql`: SQL function `run_absence_detection(as_of timestamptz default now())` returning a list of newly-created alerts; uses window functions over counted events
- [ ] 2.2 `recompute_absence_for_person(person_id uuid)` — idempotent, used after retroactive attendance edits
- [ ] 2.3 Unit tests (pgTAP or Jest + pg) with table-driven cases covering:
  - Normal streak reaching threshold → alert
  - Streak not reaching threshold → no alert
  - Non-counted attendance mid-streak → streak unchanged
  - New member before first counted event → no alert
  - Admin reassigns person mid-streak → alert still belongs to new assigned_servant
  - Duplicate detection runs don't create duplicate alerts (dedup)
  - Per-priority thresholds: high=2 triggers earlier than low=4

## 3. Edge Function wrapper

- [ ] 3.1 `supabase/functions/detect-absences`: calls `run_absence_detection` via service role; logs summary
- [ ] 3.2 Extend `calendar-sync` to invoke `detect-absences` when counted event data changed
- [ ] 3.3 Cron: invoke daily at 23:00 Berlin as a belt-and-suspenders schedule
- [ ] 3.4 Manual invocation endpoint for admin "Re-detect now"

## 4. Admin Settings UI

- [ ] 4.1 `features/settings/screens/absence-config.tsx` (admin only)
  - Default threshold input
  - Per-priority threshold grid (4 rows for the 4 priority values)
  - Toggle "Also notify admins"
  - "Re-detect now" button
- [ ] 4.2 Use `absence_config` upsert RPC
- [ ] 4.3 i18n strings for all controls

## 5. Tests

- [ ] 5.1 Unit: UI form validation (threshold must be > 0 integer)
- [ ] 5.2 Integration: admin edit changes config and subsequent detection uses new thresholds
- [ ] 5.3 End-to-end: simulate 3 weeks of counted events with attendance gaps; verify expected alerts fire

## 6. Verification

- [ ] 6.1 Manual: configure high=2, attend, skip 2 counted events → detection fires → alert row present
- [ ] 6.2 Manual: admin changes threshold; re-detect; old alerts not duplicated
- [ ] 6.3 `make test`, `make lint`, `make typecheck` pass
- [ ] 6.4 `openspec validate add-absence-config-and-detection` passes
- [ ] 6.5 Every scenario in `specs/absence-detection/spec.md` and the delta in `specs/settings/spec.md`
