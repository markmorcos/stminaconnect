## Why

Every feature beyond auth deals with people: registration creates them, attendance references them, dashboards aggregate them, follow-ups target them. Defining the `persons` table, its RLS policies, and a small set of read RPCs now — ahead of registration UI — lets every feature change build on a stable foundation. Privacy is established at the data layer (private comments) so no later code can accidentally leak.

## What Changes

- **ADDED** capability `person-management`.
- **ADDED** `persons` table (full v1 shape — see `design.md` §Decisions for the columns).
- **ADDED** `assignment_history` table (records when a person is assigned/reassigned to a servant; supports Open Question B1's "comments visible to current assigned servant only" rule).
- **ADDED** RLS policies on `persons`:
  - Servants and admins can SELECT all rows EXCEPT the `comments` field.
  - The `comments` field is exposed only via an RPC that filters: visible to assigned servant + admins.
  - INSERT/UPDATE/DELETE allowed only via RPCs.
- **ADDED** Soft-delete: `deleted_at` column. Reads filter it out by default; an admin-only RPC includes deleted rows.
- **ADDED** RPCs:
  - `list_persons(filter jsonb) RETURNS SETOF persons_public` — public projection (no comments).
  - `get_person(person_id uuid) RETURNS persons_with_comments_if_visible` — comments included only if caller is assigned servant or admin.
  - `create_person(payload jsonb) RETURNS uuid` — used by registration phases.
  - `update_person(person_id uuid, payload jsonb) RETURNS persons` — same, with field-level whitelist.
  - `assign_person(person_id uuid, servant_id uuid) RETURNS void` — admin-only; logs to `assignment_history`.
  - `soft_delete_person(person_id uuid) RETURNS void` — admin-only; scrubs PII per Open Question B2.
- **ADDED** Person list screen `app/(app)/persons/index.tsx` (admin/servant view, no edit yet — full CRUD UI lands in phase 6).
- **ADDED** Person profile screen `app/(app)/persons/[id].tsx` (read-only view of all fields + comments-if-visible).
- **ADDED** `seed.sql` script populating the seed described in `project.md` §6 (5 servants, 20 persons across languages/regions).
- **ADDED** Translation keys for `persons.*` namespace in EN/AR/DE.

## Impact

- **Affected specs**: `person-management` (new). `auth` unchanged.
- **Affected code**: `supabase/migrations/002_persons.sql`, `003_assignment_history.sql`, `004_person_rpcs.sql`. New `app/(app)/persons/{index.tsx,[id].tsx}`. New `src/services/api/persons.ts`. New `src/features/persons/components/*`. Updated `supabase/seed.sql`.
- **Breaking changes**: none — additive.
- **Migration needs**: three new migrations. Seed is idempotent (truncate-and-reload).
- **Expo Go compatible**: yes — pure data model + read screens; no native modules.
- **Uses design system**: yes — list rows use design-system `Avatar`, `Badge`, `Card`; profile uses design-system `Stack`, `Text` variants, `Divider`. No ad-hoc styling.
- **No member photos in v1**: profile screens display initials in a deterministically-colored avatar (via design-system `Avatar`); no `photoUrl` column exists; storage and upload UI explicitly out of scope.
- **Dependencies**: `init-project-scaffolding`, `setup-design-system`, `add-brand-assets`, `add-servant-auth`, `add-i18n-foundation`.
