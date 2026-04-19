## 1. Validation

- [ ] 1.1 Extend `features/registration/validators.ts` with `fullRegistrationInput` (Quick Add fields + `priority`, `assignedServantId`, `comment` optional)
- [ ] 1.2 Unit tests: priority enum, invalid servant id rejected, comment optional

## 2. Shared form component

- [ ] 2.1 Extract `components/domain/person-form.tsx` with `variant: 'quick' | 'full'` controlling which fields show
- [ ] 2.2 Refactor Quick Add screen to use the shared component
- [ ] 2.3 Component tests for both variants

## 3. Person detail

- [ ] 3.1 `app/person/[id].tsx` with tabs: Info | Attendance | Comments (Attendance content stub)
- [ ] 3.2 Header component: name, status badge, assigned-servant avatar + name, overflow menu
- [ ] 3.3 Info tab: phone, region, language, priority, registered_at, registered_by
- [ ] 3.4 Comments tab: renders comments via `useQuery(['person', id], () => getPerson(id))`; if `comments === null`, show a subtle lock icon + "Comments are visible to the assigned servant." (without revealing any content); if empty array, show "No comments yet — tap + to add"
- [ ] 3.5 Add-comment input at bottom of Comments tab (for assigned servant and admins); mutation via `addPersonComment` (added to `services/api/persons.ts`)
- [ ] 3.6 Delete-comment action (own comments within 24h, any for admins) with confirmation

## 4. Edit / Full Registration

- [ ] 4.1 `app/full-registration.tsx`: standalone entry (home "New member" button)
- [ ] 4.2 `app/person/[id]/edit.tsx`: same form, pre-populated from `get_person`
- [ ] 4.3 "Complete details" action on Quick Add records deep-links to edit screen; submit sets `registration_type = 'full'`

## 5. Admin reassign

- [ ] 5.1 Header overflow menu shows "Reassign" item when session role is admin; hidden otherwise
- [ ] 5.2 Reassign sheet: servants picker (from `list_servants`), confirm dialog, call `reassign_person` RPC
- [ ] 5.3 After reassign, invalidate `['person', id]` and show toast; if the current user was previously assigned, their comment-view access disappears on the next load

## 6. i18n

- [ ] 6.1 Add `src/i18n/locales/{en,ar,de}/person.json` with all Person detail + Comments + Reassign strings
- [ ] 6.2 Extend `registration.json` with Full Registration-specific strings

## 7. Verification

- [ ] 7.1 Integration tests: RLS returns `null` for comments when unassigned; UI renders lock state
- [ ] 7.2 Integration tests: reassign moves comment access from old to new assignee
- [ ] 7.3 Manual: upgrade a Quick Add to Full; verify `registration_type` updates and new comment appears
- [ ] 7.4 Manual: admin reassigns; old servant loses comment access on reload
- [ ] 7.5 `make test`, `make lint`, `make typecheck` pass
- [ ] 7.6 `openspec validate add-full-registration` passes
- [ ] 7.7 Every scenario in `specs/registration/spec.md` (delta) and `specs/person-management/spec.md` (delta) verified
