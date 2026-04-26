## Context

This is the data foundation for the rest of the app. The schema must support: trilingual data, region grouping, priority/assignment, private comments, soft-delete, and (via assignment_history) reassignment audit. Three later phases — Quick Add, Full Registration, Attendance — write into this model; many phases read from it.

We split read paths from write paths via RPCs because:

- The mobile client never directly inserts; it goes through `create_person`/`update_person` which apply server-side defaults (`createdBy`, `registrationType`, `status`).
- The `comments` privacy rule (visible to assigned servant + admins) is too nuanced to express cleanly in a single SELECT policy. An RPC returning a curated projection is simpler.
- Soft-delete filtering is centralized.

## Goals

- One `persons` row per real-world person.
- All registration flows (Quick Add and Full) populate the same row, distinguished only by `registration_type`.
- Privacy-by-default for `comments`.
- Auditable reassignments.
- Soft-delete with PII scrubbing for GDPR right-to-erasure.
- Stable RPCs that subsequent phases can build on without schema changes.

## Non-Goals

- Person editing UI (lands in `add-full-registration`).
- Newcomer entry UI (`add-quick-add-registration` and `add-full-registration`).
- Attendance, follow-ups, or any computed fields. We expose raw data; computation is in later phases.
- Bulk import. CSV import is out of scope for v1 — the manual seed + Quick Add flow cover initial population.
- **Member profile photos.** Out of scope for v1. Profiles display initials in a colored avatar (design-system `Avatar`); the schema has no `photoUrl` column. Adding photos later is a forward-compatible additive migration plus storage/upload UI plus moderation tooling — explicitly deferred.

## Decisions

1. **Schema** for `persons`:
   ```
   id                uuid pk default gen_random_uuid()
   first_name        text not null
   last_name         text not null
   phone             text                                  -- E.164, nullable for legacy/unknown
   region            text                                  -- free text
   language          text not null check (in 'en','ar','de')
   priority          text not null default 'medium' check (in 'high','medium','low','very_low')
   assigned_servant  uuid not null references servants(id)
   comments          text                                  -- private; never selected directly
   status            text not null default 'new' check (in 'new','active','inactive','on_break')
   paused_until      date                                  -- only meaningful when status='on_break'
   registration_type text not null check (in 'quick_add','full')
   registered_by     uuid not null references servants(id)
   registered_at     timestamptz not null default now()
   created_at        timestamptz not null default now()
   updated_at        timestamptz not null default now()
   deleted_at        timestamptz
   ```
2. **`assignment_history`** schema:
   ```
   id              uuid pk default gen_random_uuid()
   person_id       uuid not null references persons(id) on delete cascade
   from_servant    uuid references servants(id)
   to_servant      uuid not null references servants(id)
   changed_by      uuid not null references servants(id)
   changed_at      timestamptz not null default now()
   reason          text
   ```
   A trigger on `persons.assigned_servant` updates inserts a row whenever the value changes.
3. **No `is_admin` boolean on `persons`** — admin-ness is a role on `servants`, never on `persons`. Members do not log in.
4. **`status` is enumerated, not derived.** Computing "active" from attendance history would tie this model to phases that don't exist yet. Status transitions happen via explicit RPC calls (later phases).
5. **`comments` privacy enforcement is centered on the RPC, not RLS.** A SELECT policy that conditionally hides one column is awkward in PostgreSQL. Instead:
   - Direct `SELECT * FROM persons` from the client returns no rows (RLS denies all client SELECTs on the table itself).
   - Reads go through `list_persons` (no comments) and `get_person` (comments included if caller qualifies).
   - This is the **RPC-only client access** pattern from `project.md` §6.
6. **Soft-delete behavior**: `soft_delete_person` sets `deleted_at = now()`, sets `first_name = 'Removed'`, `last_name = 'Member'`, `phone = null`, `comments = null`. Attendance records are kept (the `attendance.person_id` FK remains valid). This satisfies Open Question B2.
7. **Phone is not unique.** Per Open Question B3. Duplicate detection is a soft check at registration (introduced in phase 5).
8. **Seed script**: 1 admin + 4 servants; 20 persons across regions (Schwabing, Maxvorstein, Sendling, Pasing, "outside Munich"); language mix (10 EN, 5 DE, 5 AR); priority mix; 3 of the 20 in `on_break`. Idempotent: wraps in a transaction that truncates first.
9. **Person list (admin/servant) is the same screen** — both roles see the same list, but only admins see the "Reassign" action (added in phase 6 alongside edit). RLS already exposes the same row set.
10. **No pagination in v1.** <200 persons fits in a single FlatList. We lazy-render via FlatList anyway.

11. **Avatars (no photos)**: list rows and profile headers use the design-system `Avatar` component, which computes a background color via `colorIndex = fnv1aHash(person.id) mod 8` against `tokens.avatarPalette` (defined in `setup-design-system`). The 8 palette colors are pre-verified to pass WCAG AA Large for white text. Initials are first-letter-of-first-name + first-letter-of-last-name, Unicode-aware (works for Arabic). Determinism is important: the same person always shows the same color across screens and devices, giving servants a small visual recognition cue without a photo.

## Risks / Trade-offs

- **Risk**: The combination of "RLS denies all SELECT" + "RPCs do the real work" requires every mobile read path to be an RPC. Mitigation: codified in a `services/api/persons.ts` module so screens never call `from('persons')` directly.
- **Trade-off**: Trigger-based `assignment_history` insertions mean changes outside the assign RPC (e.g. direct dashboard edits) still get logged. Win.
- **Risk**: Soft-delete with PII scrubbing is irreversible — once scrubbed, can't restore. Mitigation: `soft_delete_person` is admin-only; phase 18's runbook documents that this is the right-to-erasure path.

## Migration Plan

- Three migrations applied in order: `002_persons.sql`, `003_assignment_history.sql`, `004_person_rpcs.sql`.
- Seed script applied via `make seed` (now functional, replacing phase 1's placeholder).
- Rollback: down migrations drop in reverse order.

## Open Questions

- None.
