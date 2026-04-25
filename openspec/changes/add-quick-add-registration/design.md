## Context

The newcomer is a non-app-user filling a form on a stranger's phone, mid-conversation, possibly in a language different from the servant's UI. The form must be friendly without being lengthy. Five fields is the agreed minimum for the church to make first contact later (name + phone) plus context (region + language).

## Goals

- ≤ 2 taps from home to a focused first-name input.
- Newcomer can switch the form's labels into their language without affecting the rest of the app.
- One screen, one scroll, no multi-step wizard.
- Phone defaults to +49 (Munich is in Germany) but accepts other prefixes.
- Soft duplicate warning, never a hard block.
- Save in <500ms over Wi-Fi; failures recoverable.

## Non-Goals

- Photo upload (deferred — out of v1).
- Family/relationship linking (out of v1).
- Profile editing post-creation (lands in phase 6).
- Comments / priority / explicit servant assignment (those are Full Registration territory).

## Decisions

1. **5 fields, no more, no less.** Anything else dilutes the brief promise.
2. **Form label language is independent of app language.** When the newcomer taps Arabic, the form re-renders with Arabic labels and helper texts using a local i18n context override (`<I18nextProvider i18n={localI18n}>`). The rest of the app and the saved record's `language` field reflect the newcomer's choice; the *app* language doesn't change. RTL is only applied to the form's content area, via `style={{ direction: 'rtl' }}` on the form container — not full app RTL toggle.
3. **Default values:**
   - `language = active app language` (i18next current).
   - `phone` prefilled with `+49 ` (cursor positioned after the space).
   - All other fields empty.
4. **Validation** (RHF + Zod):
   - First / Last name: required, min 1, max 100, trimmed.
   - Phone: required, must match `/^\+\d{9,15}$/` after stripping spaces.
   - Region: optional, max 100, trimmed.
   - Language: required, enum `en|ar|de`.
5. **Auto-assignment**: `create_person` payload sets `assigned_servant = auth.uid()`. Servant ID is derived server-side; payload need not include it. The RPC accepts `assigned_servant` only when caller is admin (overriding for direct admin Quick Add); for plain servants the RPC ignores the field and uses `auth.uid()`.
6. **Soft duplicate detection**: an extra RPC `find_potential_duplicate(first text, last text, phone text) RETURNS uuid` returns the most recent matching row id (ILIKE on names + exact-string match on phone) or null. The mobile UI calls this on submit before `create_person`. If non-null, it shows a Paper Dialog with "Use existing" (navigates to that profile) and "Save anyway" (proceeds with `create_person`).
7. **Optimistic UI vs honest UI**: we choose **honest** here. The submit button shows a brief loading state until `create_person` returns. Quick Add is too short to justify rollback complexity, and the success-without-network failure case is awkward.
8. **Post-save behaviour**: on success, navigate back to home with a Snackbar "Welcome [first name]!" (in the active app language, not the newcomer's language — the servant is the one reading it).
9. **Direct manipulation of `priority` is hidden**. The default `medium` is set server-side. To change priority, the servant uses Full Registration (phase 6) or the upgrade flow.

## Risks / Trade-offs

- **Risk**: per-form language override is a new pattern. Mitigation: it's localized to the form component; doesn't leak into the rest of the app. We document and write a component test.
- **Risk**: the +49 default is wrong for non-German numbers. Mitigation: cursor lands after `+49 `, easy to delete. We accept brief annoyance for the common-case win.
- **Trade-off**: Soft duplicate detection RPC may surface false positives (common Coptic names: Mina, Mariam). Acceptable — the dialog asks the servant to make the call.

## Migration Plan

- New RPC `find_potential_duplicate` lives in `005_find_potential_duplicate.sql`.
- No schema change.

## Open Questions

- **B3** (phone uniqueness): proposed default applied — soft warning, no block.
