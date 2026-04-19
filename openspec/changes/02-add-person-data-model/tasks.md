## 1. Schema

- [ ] 1.1 Migration `003_create_persons.sql`: create enums `person_status`, `person_priority`, `person_language`, `registration_type`; create `persons` table with all columns and the generic `updated_at` trigger
- [ ] 1.2 Migration `004_person_comments.sql`: create `person_comments` table (`id`, `person_id`, `body text`, `author_id`, `created_at`, `updated_at`, `archived_at`)
- [ ] 1.3 Add `CHECK` constraint on `persons.phone` for E.164-like pattern; document pattern in a comment on the constraint

## 2. RLS

- [ ] 2.1 Migration `005_persons_rls.sql`: enable RLS; policy allowing SELECT for all authenticated (active) users on non-archived persons; policy allowing INSERT/UPDATE only when caller is admin OR `assigned_servant_id = auth.uid()`
- [ ] 2.2 Same migration: RLS on `person_comments`: SELECT allowed if caller is admin OR caller is currently assigned to the person; INSERT allowed if caller is admin OR assigned; UPDATE allowed only to the comment author within 24h of creation (or anytime for admin)
- [ ] 2.3 Integration tests covering each policy combination (admin read, servant assigned read, servant unassigned read of persons vs comments, update restrictions)

## 3. RPCs

- [ ] 3.1 Migration `006_person_rpcs.sql`:
  - `create_person(payload jsonb)` — validates, inserts, returns the new row
  - `update_person(id uuid, payload jsonb)` — partial update, RLS enforces who
  - `get_person(id uuid)` — returns person + comments the caller can see
  - `list_persons(filters jsonb)` — filters by status, assigned_servant_id, text query (ILIKE on first_name || ' ' || last_name); paginated
  - `reassign_person(id uuid, new_servant_id uuid)` — admin only
- [ ] 3.2 Unit tests for each RPC's validation (invalid phone, invalid enum, missing required fields)
- [ ] 3.3 Integration tests for each RPC exercising RLS paths

## 4. Servants view

- [ ] 4.1 Migration `007_servants_view.sql`: create view `servants` selecting from `profiles` where `role = 'servant'`, joined with a count of `assigned_persons`
- [ ] 4.2 RLS-equivalent using `security_barrier`; only admins see full list, servants see other active servants (names only)

## 5. Seed data

- [ ] 5.1 Write `supabase/seed.sql`:
  - 2 admins, 5 servants (all with `display_name`)
  - 20 persons distributed across all languages + priorities + regions; mix of `new` and `active` statuses; 2 flagged `inactive`; 1 `archived_at` set
  - Each active/new person assigned to one of the 5 servants
  - Seed 3 comments spread across a few persons
- [ ] 5.2 Add `make seed` target that runs migrations then seeds, and prints a summary
- [ ] 5.3 Add `make reset-db` that drops and recreates the local DB and re-seeds

## 6. TypeScript types

- [ ] 6.1 Add `make gen-types` target running `supabase gen types typescript --local` and writing to `apps/mobile/src/types/database.generated.ts`
- [ ] 6.2 Commit the generated file
- [ ] 6.3 Add `services/api/persons.ts` with typed wrappers: `listPersons(filters)`, `getPerson(id)`, `createPerson(input)`, `updatePerson(id, patch)`, `reassignPerson(id, newServantId)`
- [ ] 6.4 Add `services/api/servants.ts`: `listServants()`
- [ ] 6.5 Unit tests for the API wrappers (mock Supabase client)

## 7. Verification

- [ ] 7.1 Run `make test`, `make lint`, `make typecheck` — all pass
- [ ] 7.2 Run `make seed` from scratch; inspect Supabase Studio and confirm data is present
- [ ] 7.3 `openspec validate add-person-data-model` passes
- [ ] 7.4 Manual verification: every scenario in `specs/person-management/spec.md`
