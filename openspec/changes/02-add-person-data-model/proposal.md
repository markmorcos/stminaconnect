## Why

Every downstream feature — registration, attendance, absence alerts, dashboards — reads from or writes to the `persons` table. This change defines that table, its RLS policies, basic CRUD RPCs, generated TypeScript types, and a realistic seed dataset. No user-facing screens yet; we are establishing the data foundation.

We put this before any registration UI so that registration change can focus purely on the form flow, not on schema decisions.

## What Changes

- **ADDED** `person-management` capability:
  - `persons` table with all fields required across the product (names, phone, region, language, priority, status, assigned servant, comments, registration metadata, audit).
  - `servants` helper view joining `profiles` + useful aggregates (for now: `profile_id`, `display_name`, `active`, `assigned_persons_count`).
  - RLS policies: admins read/write all; servants read all active `persons` (needed for event-day search), write only their assigned `persons`; comments column restricted.
  - RPCs: `create_person`, `update_person`, `get_person`, `list_persons` (with filters: status, assigned_servant_id, query).
  - Seed data: ~20 realistic members across languages, regions, priorities; distributed across 5 servants.
  - TypeScript types auto-generated from the schema via `supabase gen types typescript`.

## Impact

- **Affected specs:** `person-management` (new)
- **Affected code (preview):**
  - Migrations: `003_create_persons.sql`, `004_persons_rls.sql`, `005_person_rpcs.sql`, `006_servants_view.sql`
  - Seed: `supabase/seed.sql` populated
  - Mobile: `types/database.generated.ts` (codegen output), `services/api/persons.ts` (thin wrappers for RPCs), `services/api/servants.ts`
  - Makefile: `make gen-types` target added
- **Breaking changes:** none.
- **Migration needs:** first schema migrations. Seeded data is local-only.
- **Depends on:** `add-servant-auth` (uses `profiles.id` as FK and `auth_context` for RLS).
