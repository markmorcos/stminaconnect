## Context

This is the app's first real feature. We are balancing two competing forces:
1. **UX speed.** The newcomer is holding a borrowed phone; they will abandon a long or confusing form.
2. **Data quality.** If we accept any garbage, reporting is useless.

We solve this by making only the absolute minimum required (4 fields actually required; region is optional), and leaning on inline validation rather than blocking modal errors.

## Goals

- 5 fields on a single scrollable screen; no multi-step wizard.
- Phone input auto-prefixes `+49` so the newcomer types only the local portion.
- Works under airplane mode? **Not in this change** — goes through the online RPC. Offline support lands in `add-offline-sync`. Explicitly: if offline, the form shows a "no connection — please try again" error.
- Language selector is a segmented control (3 buttons), not a dropdown — faster to tap.
- Full flow in all three languages at ship time, including the duplicate-warning dialog.

## Non-Goals

- Offline support for Quick Add in this change. Added in `add-offline-sync`.
- Photo capture / attachments.
- Multi-person registration (families).
- Any admin oversight / approval step.

## Decisions

1. **Single screen, React Hook Form + Zod resolver.** Zod schema lives in `features/registration/validators.ts` so it can be reused by Full Registration later. The schema is versioned (a `schema_version: 1` field in the submitted payload) so we can evolve without breaking local-cached drafts.

2. **Phone input: `react-native-phone-number-input` or similar; default country +49.** Stored as E.164 (`+49...`). The RPC validates format again server-side; client pre-validates to save round-trips.

3. **Language default = current app language, not newcomer's implied language.** Reason: the servant and newcomer likely speak the same language, which is already the app language. Newcomer can change if different.

4. **Duplicate detection is a client-side lookup by phone** (`list_persons({ phone: normalized })`) before submit. If a match is found, a bottom-sheet appears with the match + two buttons ("View existing", "Continue anyway"). Checking happens when phone field blurs with a valid number, not on every keystroke.

5. **Success UX is a toast + navigation back to home, not a confirmation screen.** Confirmation screens feel heavyweight. The toast says "Maria Youssef added — assigned to you." Assignment is explicit so the servant knows they now own this person.

6. **No "edit before submit" multi-step.** One form, one submit. If the servant wants to enrich with priority/comments, that is Full Registration, accessed from the new Person's profile.

7. **Haptic feedback on submit success** (using `expo-haptics`). Small touch that makes the 30-second flow feel polished.

## Risks / Trade-offs

- **Risk:** Duplicate check is susceptible to slight phone-formatting differences. Mitigated by normalizing to E.164 before comparing.
- **Trade-off:** No offline support means the flow fails in church basements with poor coverage. Acceptable for first release; explicitly flagged and fixed in `add-offline-sync` before we consider the product shippable.
- **Trade-off:** The duplicate warning is soft (can continue anyway), which allows intentional family dupes but also accidental dupes. We accept this; a later change could add a merge tool.

## Open Questions

See `_open-questions.md` #2.
