## Why

The primary newcomer-capture flow: a servant hands their phone to a visitor, who fills a minimal 5-field form. It must be fast (≤ 2 taps from home, ≤ 30 seconds to fill), auto-assign to the initiating servant, and work in any of the three languages.

This is the first user-facing feature. Most of the app's value to the church is in what happens after a newcomer is in the system, so getting them in must be frictionless.

## What Changes

- **ADDED** `registration` capability — Quick Add flow:
  - Home tab gains a primary "Quick Add" action (large button, single tap from home).
  - Quick Add form screen with 5 fields (first name, last name, phone, region, language) — region optional, rest required.
  - Phone input formatted to E.164 with `+49` default; basic inline validation.
  - Language selector shows the three supported languages; defaults to current app language.
  - On submit: calls `create_person` RPC with `registration_type = 'quick_add'` and `assigned_servant_id = auth.uid()`.
  - Success → toast + return to home. Failure → inline error with retry.
  - Soft duplicate warning: if a person with the same phone exists, show "A member with this phone already exists — continue anyway?" (Open Question #2 default).
- **ADDED** `i18n` (minimal subset): just the keys needed for Quick Add, in all three languages, since the form itself must be trilingual from day one. Full i18n infrastructure lands in `add-i18n-foundation`.

## Impact

- **Affected specs:** `registration` (new), `i18n` (new — minimal)
- **Affected code (preview):**
  - Mobile: `app/(tabs)/index.tsx` (add Quick Add button), `app/quick-add.tsx` (screen), `features/registration/hooks/use-create-person.ts`, `features/registration/validators.ts` (Zod schemas)
  - i18n: `src/i18n/index.ts` bootstrap, `src/i18n/locales/{en,ar,de}/registration.json` (Quick Add keys only)
  - Tests: unit tests for Zod schema, RTL tests for form submission + duplicate warning
- **Breaking changes:** none.
- **Migration needs:** none (uses existing RPCs).
- **Depends on:** `add-person-data-model`, `add-servant-auth`.
