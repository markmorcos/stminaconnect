## Context

The data model is the system's spine. We have one clear aggregate (`Person`) with a few enums, assignment to a `profiles` row, and tight privacy rules on comments. Getting these right up front is cheaper than retrofitting later.

Key tension: servants need a broad SELECT on `persons` to run event-day searches ("find Maria across all 200 members to check her in"), but they must NOT see comments on members they are not assigned to. Supabase RLS cannot hide individual columns via standard policies, so we use a separate `person_comments` table to scope comment visibility independently.

## Goals

- A single `persons` table that captures every field referenced by the feature specs, no more, no less.
- RLS policies that enforce "servants see all active persons for search; admins see everything; comments are per-assignment".
- Column types picked for correct Postgres semantics (enums, not text; phone as text with validation).
- Seed data that lets future development happen without constant manual test-data creation.
- Generated TypeScript types so mobile and Edge Functions share a type contract.

## Non-Goals

- No audit log of field-level changes in v1 (just `updated_at`, `updated_by`).
- No attachments / photos on persons in v1. (Could be added as a `person_attachments` table later.)
- No family/household grouping — each person is independent. (Explicit non-goal — pastoral team may want households later; revisit.)
- No geographic region validation — region is free text.

## Decisions

1. **Single `persons` table, no split between "newcomer" and "member".** A newcomer is just a person with `status = new` and a recent `created_at`. Splitting tables would duplicate columns and complicate queries. Status enum: `new | active | inactive` (plus `archived_at` timestamp for GDPR delete).

2. **Comments in a separate `person_comments` table**, with its own RLS. The `persons` table has no `comments` column. This gives us:
   - Column-level privacy without RLS workarounds.
   - Full comment history (author, timestamp, edits).
   - Easier future enhancement (per-comment visibility).

3. **Phone stored as `text`, validated via `CHECK` constraint for E.164-like format, default country code +49.** We don't normalize (e.g. strip spaces) at the DB level — the client does, so it's a single place.

4. **Enums via Postgres types, not `text CHECK IN (...)`.** Postgres enums are cheaper to filter on and give us typed codegen. Enums: `person_status` (`new`, `active`, `inactive`), `person_priority` (`high`, `medium`, `low`, `very_low`), `person_language` (`en`, `ar`, `de`), `registration_type` (`quick_add`, `full`).

5. **`assigned_servant_id` is nullable** to allow the "unassigned" state for Open Question #9 (deactivated servant's members). RLS enforces that unassigned persons are admin-write-only.

6. **Servant-scoped write access via `auth_context().user_id = persons.assigned_servant_id`.** Admins bypass this via a separate policy checking `role = 'admin'`. `USING` and `WITH CHECK` are both set; servant cannot reassign a person to another servant (that's admin only).

7. **RPCs instead of direct table access from the client.** Rationale:
   - Validation (E.164 phone, enum values) lives in one place.
   - Future audit hooks plug in without client changes.
   - `list_persons` can accept filters and do smart sorting (at-risk first, etc.) server-side, reducing client complexity.
   - The client still uses the generated types from the table schema, so the contract stays tight.

8. **Seed uses `pgcrypto` `gen_random_uuid()` with fixed seeds** (via `setseed()`) so rerunning gives identical data.

9. **Codegen with `supabase gen types typescript --local > apps/mobile/src/types/database.generated.ts`.** Exposed via `make gen-types`. The generated file is committed to git (not gitignored) so CI typechecks are deterministic and so reviewers can see schema impact in diffs.

## Risks / Trade-offs

- **Risk:** Letting servants SELECT all active persons means any compromised servant account can exfiltrate the directory. Acceptable for v1 (our threat model is "well-meaning but not technical"); if it becomes a concern, we can add a separate `persons_lookup` view exposing only name + phone for search and move full detail behind assignment.
- **Trade-off:** Separate `person_comments` table = an extra join for profile views. Minor perf cost, clean privacy.
- **Trade-off:** Committing generated types adds noise to PR diffs when schema changes. Offset by the determinism benefit.

## Migration Plan

Migrations in order:
1. `003_create_persons.sql` — enums, table, `updated_at` trigger.
2. `004_person_comments.sql` — comments table.
3. `005_persons_rls.sql` — RLS policies on both tables.
4. `006_person_rpcs.sql` — `create_person`, `update_person`, `get_person`, `list_persons`, `reassign_person` (admin).
5. `007_servants_view.sql` — helper view for UI.

Seed populates after all migrations. No production migration story yet — that's `setup-production-deployment`.

## Open Questions

- Open Question #2 (phone uniqueness): default is non-unique. Implemented here; no unique index on `phone`.
- Open Question #3 (comment privacy on reassignment): default is "new servant sees all, old loses access". Implemented via RLS that keys off current `assigned_servant_id`, not comment authorship.
- Open Question #9 (deactivated servant's members): default "unassigned" state. Implemented as nullable `assigned_servant_id`.
