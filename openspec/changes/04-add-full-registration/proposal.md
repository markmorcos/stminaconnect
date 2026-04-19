## Why

Quick Add captures the minimum. Once a servant has more time (or the newcomer has been around a few weeks), they need to enrich the record with priority, comments, and possibly reassign. This change adds the Full Registration form, Person detail/edit view, and the "upgrade a Quick Add to Full" flow. Comments privacy becomes fully enforced in the UI.

## What Changes

- **MODIFIED** `registration` capability:
  - Adds Full Registration screen reachable (a) from home "New member" button → full form, or (b) from a Quick Add record's profile as "Complete details".
  - Full form = Quick Add fields + priority (enum) + assigned-servant picker (defaults to current user) + comments.
- **ADDED** `person-management` UI (spec is additive on top of data-model spec):
  - Person detail screen: header with name + status badge + assigned-servant, tabs for "Info", "Attendance" (stub — fills in later change), "Comments".
  - Edit Person screen (reuses Full Registration form, pre-populated).
  - Comments section honors RLS (visible only to assigned servant + admins); shows empty-state for unassigned servants viewing someone else's person.
  - Admin-only "Reassign" action on the Person detail.
- The "upgrade" flow writes an update with `registration_type: 'full'` and appends any new comment as a new `person_comments` row.

## Impact

- **Affected specs:** `registration` (MODIFIED — adds full flow), `person-management` (ADDED — UI requirements on top of data-model)
- **Affected code (preview):**
  - Mobile: `app/full-registration.tsx`, `app/person/[id].tsx`, `app/person/[id]/edit.tsx`, `features/registration/validators.ts` (extend schema), `features/person/hooks/use-person.ts`, `components/domain/comment-list.tsx`, `components/domain/person-header.tsx`
  - i18n: new keys in `registration.json`, `person.json`
  - Tests: comment RLS visibility in UI, reassign action gated by role
- **Breaking changes:** none — Quick Add continues to work as before.
- **Migration needs:** none.
- **Depends on:** `add-quick-add-registration`, `add-person-data-model`.
