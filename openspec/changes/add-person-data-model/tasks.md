# Tasks — add-person-data-model

## 1. Schema migrations

- [ ] 1.1 `002_persons.sql`: create `persons` table with the schema in `design.md` §Decisions, plus indexes on `assigned_servant`, `region`, `status`, and `(deleted_at) WHERE deleted_at IS NULL`
- [ ] 1.2 `002_persons.sql`: enable RLS on `persons`; add a single deny-all policy for direct client SELECT/INSERT/UPDATE/DELETE
- [ ] 1.3 `003_assignment_history.sql`: create table per design + index on `person_id`
- [ ] 1.4 `003_assignment_history.sql`: trigger `tg_persons_assignment_change` on UPDATE OF `assigned_servant` — inserts row into `assignment_history`
- [ ] 1.5 Run `make migrate-up`; verify tables in Supabase dashboard

## 2. RPCs

- [ ] 2.1 `004_person_rpcs.sql`: `list_persons(filter jsonb DEFAULT '{}'::jsonb)` returns all non-deleted rows projected without `comments`; supports filters `assigned_servant`, `region`, `status`, `search` (ILIKE on first/last name)
- [ ] 2.2 `004_person_rpcs.sql`: `get_person(person_id uuid)` returns all fields including `comments`, but `comments` is null unless caller is admin or assigned servant
- [ ] 2.3 `004_person_rpcs.sql`: `create_person(payload jsonb)` validates required fields, sets `registered_by = auth.uid()`, `registered_at = now()`, returns id
- [ ] 2.4 `004_person_rpcs.sql`: `update_person(person_id uuid, payload jsonb)` whitelists allowed fields; admin-only fields gated
- [ ] 2.5 `004_person_rpcs.sql`: `assign_person(person_id uuid, servant_id uuid, reason text)` admin-only — sets `assigned_servant` (trigger logs history)
- [ ] 2.6 `004_person_rpcs.sql`: `soft_delete_person(person_id uuid)` admin-only; sets `deleted_at`, scrubs PII
- [ ] 2.7 All RPCs `SECURITY DEFINER`, with explicit `auth.uid()` checks inside

## 3. Mobile API client

- [ ] 3.1 `src/services/api/persons.ts` exposing typed wrappers: `listPersons(filter)`, `getPerson(id)`, `createPerson(payload)`, `updatePerson(id, payload)`, `assignPerson(id, servantId, reason)`, `softDeletePerson(id)`
- [ ] 3.2 Type definitions in `src/types/person.ts` matching the table shape

## 4. Person list screen

- [ ] 4.1 `app/(app)/persons/_layout.tsx` — Stack header titled `t('persons.list.title')`
- [ ] 4.2 `app/(app)/persons/index.tsx` — TanStack Query `useQuery(['persons', filter], () => listPersons(filter))`
- [ ] 4.3 List item: name, region, priority chip, assigned-servant initials, status chip
- [ ] 4.4 Search input filtering by name (debounced 300ms)
- [ ] 4.5 Empty state, loading skeleton, error state
- [ ] 4.6 Tap → navigate to `/persons/[id]`

## 5. Person profile screen

- [ ] 5.1 `app/(app)/persons/[id].tsx` — TanStack Query `useQuery(['person', id], () => getPerson(id))`
- [ ] 5.2 Display all fields. Show `comments` section only if returned non-null. If null and caller is not admin/assigned, show a Paper Banner: `t('persons.profile.commentsHidden')`
- [ ] 5.3 No edit affordance yet (phase 6 adds it)

## 6. Translations

- [ ] 6.1 Extend `src/i18n/locales/{en,ar,de}.json` under namespace `persons.*`: list title, list filters, list empty, profile labels (firstName, lastName, phone, region, language, priority, assignedServant, status, registeredAt, comments), profile commentsHidden message
- [ ] 6.2 Verify key-parity test still passes

## 7. Seed data

- [ ] 7.1 `supabase/seed.sql`: 1 admin (`priest@stmina.de`) + 4 servants; 20 persons matching `design.md` §8; assignment_history reflects current assignments
- [ ] 7.2 `make seed` runs the script (replaces the phase 1 placeholder)
- [ ] 7.3 Document in README how to log in as the seeded admin

## 8. Tests

- [ ] 8.1 RPC integration: `list_persons` returns no rows when called by anon; returns expected rows when called by signed-in servant
- [ ] 8.2 RPC integration: `get_person` includes `comments` when caller is assigned servant; null otherwise; null for non-admin non-assigned
- [ ] 8.3 RPC integration: `create_person` rejects payload with missing required fields; succeeds with valid payload; sets `registered_by` correctly
- [ ] 8.4 RPC integration: `assign_person` rejects from non-admin; succeeds for admin; inserts row in `assignment_history`
- [ ] 8.5 RPC integration: `soft_delete_person` rejects from non-admin; succeeds for admin; scrubs PII correctly; future `list_persons` excludes the row
- [ ] 8.6 Unit: `services/api/persons.ts` wrappers correctly map RPC responses to typed values

## 9. Verification (in Expo Go)

- [ ] 9.1 Sign in as seeded admin → navigate to /persons → list shows 20 rows
- [ ] 9.2 Tap a person → profile shows all fields including `comments`
- [ ] 9.3 Sign in as a servant who is NOT assigned to person X → profile of X shows comments-hidden banner
- [ ] 9.4 Sign in as a servant who IS assigned to person X → profile shows comments
- [ ] 9.5 Switch language to AR → list/profile labels translate; member data renders verbatim
- [ ] 9.6 `openspec validate add-person-data-model` passes
