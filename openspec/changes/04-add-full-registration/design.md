## Context

Quick Add intentionally strips everything down to the essentials. Full Registration brings back the fields that matter for ongoing care: priority and comments. In practice, ~30% of newcomers will get a Full Registration (servant invests time in the relationship); the rest remain as lightly-tracked Quick Adds until the servant decides otherwise.

We also need a Person profile screen — the first place that visually honors comment privacy and shows the consequences of who is assigned to whom.

## Goals

- Form reuse between Quick Add and Full Registration via a shared Zod schema and component.
- Person detail is the hub for everything about a member (today: info + comments; future: attendance, follow-ups).
- Upgrade flow from Quick Add to Full Registration is a single screen, pre-populated with existing fields.
- Comments UI is provably consistent with RLS: an unassigned servant sees the person's core info but no comments section at all (not even an empty state that might imply "no comments exist").

## Non-Goals

- No attendance tab content in this change — structure is in place, content arrives in `add-attendance-online`.
- No follow-up tab — arrives in `add-push-and-followups`.
- No rich-text comments; plain text only.
- No comment editing beyond "delete and re-add" for now (edit window is 24h for authors per RLS; UI exposes only delete-and-readd flow to keep the first version simple).

## Decisions

1. **Shared form component for Quick Add and Full Registration**, with a `variant` prop. Reason: the form fields are a superset; reusing avoids divergent validation.

2. **Full Registration is a top-level screen, not a modal.** Modals on React Native are awkward with complex forms and virtual keyboards. The screen pattern gives us scrollability and predictable navigation.

3. **Comments tab uses `get_person(id)`**, which already includes the comments array filtered by RLS. The UI checks whether `comments` is present (the RPC returns an empty array if visible-with-none vs. a distinguishable "hidden" marker if the caller isn't authorized). We'll encode this as: RPC returns `{ comments: Array | null }`, with `null` meaning "you don't have permission to view any". The UI renders based on that.

4. **Reassign is admin-only, behind a menu in the Person header.** Servants cannot see the reassign option at all. When an admin reassigns, we surface a confirmation dialog.

5. **Deleting a comment is soft (archived_at) even though no audit UI exists yet.** Hard delete only via a later admin action in `harden-and-polish`.

6. **Upgrade flow writes `registration_type = 'full'` and does NOT change `registered_at`.** The timestamp captures when the person first entered the system, not when their profile got fleshed out.

7. **Priority default during full registration is `medium`,** matching the DB default. Servant can lower it to `low`/`very_low` for someone unlikely to attend regularly.

## Risks / Trade-offs

- **Risk:** The RLS model returns `null` for comments when unauthorized, but a bug could leak unassigned comments. Covered by integration tests that simulate the servant role.
- **Trade-off:** No comment editing means fixing a typo requires delete-and-readd, losing original timestamp. Acceptable for v1.
- **Trade-off:** Single-variant form handles both Quick and Full — if they diverge further, we'll split.

## Open Questions

See `_open-questions.md` #3 (comment privacy on reassignment). Default is implemented: comment visibility follows current `assigned_servant_id`, not authorship.
