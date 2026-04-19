## Why

All features are shipped. Before production, we need a hardening pass across error handling, observability, empty/loading states, accessibility, performance, and GDPR affordances. This change is a single coherent pass through the app; we batch it because these items are each too small for a standalone change but together meaningfully improve shipability.

## What Changes

- **MODIFIED** multiple capabilities (surgical additions):
  - **Observability**: Sentry (or equivalent) integration in mobile + Edge Functions; scrubbing rules for PII.
  - **Error handling**: consistent error boundaries on every screen, typed error envelopes from RPCs, user-facing error messages localized.
  - **Empty/loading states**: every list has an empty state and a skeleton loading state; spinners replaced with skeletons where appropriate.
  - **Accessibility**: all tappable elements meet 44pt min target; screen-reader labels; color contrast check; dynamic type on all text.
  - **Performance**: lazy-load heavy charts; memoize list items; measure cold-start time, improve to < 2 seconds on mid-range devices.
  - **Tablet-responsive (minimal)**: ensure nothing breaks on iPad/large tablets; we are not doing split-view.
  - **GDPR**: admin action "Hard delete member" (data erasure) with confirmation + post-delete audit entry; data-export stub deferred.
  - **Settings**: "Help / Contact admin" section with church contact info; "Export my device data (JSON dump)" for servant debugging.
  - **Deactivated-user UX**: polish the screen with contact info and a re-activation request button (mailto/phone to admin).

## Impact

- **Affected specs:** polish deltas across `offline-sync`, `person-management`, `settings`, `push-notifications`, `auth`. A new consolidated `observability` capability captures the hardening-level guarantees.
- **Affected code (preview):**
  - Sentry SDK install + init in mobile + each Edge Function; env var `EXPO_PUBLIC_SENTRY_DSN`
  - Error boundary components; `components/ui/empty-state.tsx`, `components/ui/skeleton.tsx`
  - Migration `026_admin_hard_delete_audit.sql` (small audit table for hard deletes)
  - `services/api/gdpr.ts`: `hard_delete_person(id uuid)` RPC wrapper
  - Accessibility audit list + fixes
- **Breaking changes:** none.
- **Migration needs:** 1 migration.
- **Depends on:** all prior changes.
