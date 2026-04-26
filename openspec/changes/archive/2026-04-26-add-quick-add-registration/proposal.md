## Why

Quick Add is the most-used flow on Sunday mornings: a servant meets a newcomer, hands their phone over, and the newcomer fills 5 fields in their preferred language. The flow has to be brief, forgiving, and instantly satisfying — a single button on the home screen, three taps to "Saved!". Doing this without the heavier Full Registration form keeps newcomers welcome and servants moving.

## What Changes

- **ADDED** capability `registration` (Quick Add only — Full Registration lands in phase 6).
- **ADDED** "Quick Add" prominent button on the authenticated home screen.
- **ADDED** Quick Add screen `app/(app)/registration/quick-add.tsx`:
  - 5 fields: First name, Last name, Phone (default +49), Region (free text, optional), Language (radio EN/AR/DE, defaults to active app language).
  - Auto-assigns to the initiating servant (`assigned_servant = auth.uid()`).
  - Sets `registration_type = 'quick_add'`, `priority = 'medium'` (default), `status = 'new'`.
  - Language radio captures the newcomer's preferred language for the saved record. Form labels stay in the active app language (the servant is reading them); the radio does not retranslate the form.
  - Phone validation: E.164, default +49 country prefix, accepts 9–14 digits.
  - Soft duplicate detection: warns if first+last+phone matches an existing person; offers "Use existing" to navigate to that profile, or "Save anyway" to create a new row.
- **ADDED** Success toast + auto-return to home after save.
- **ADDED** Translation keys for `registration.quickAdd.*` in EN/AR/DE.
- **ADDED** Optimistic UI: form submits, immediately navigates back to home, shows success snackbar; failure rolls back with error.
- **MODIFIED** Home screen layout: "Quick Add" becomes a primary CTA button.

## Impact

- **Affected specs**: `registration` (new).
- **Affected code**: `app/(app)/index.tsx` (home CTA), `app/(app)/registration/quick-add.tsx` (new), `src/features/registration/*`, `src/services/api/persons.ts` (already exists; uses `create_person`).
- **Breaking changes**: none.
- **Migration needs**: none — `persons` already exists.
- **Expo Go compatible**: yes — pure form + RPC call.
- **Uses design system**: all UI built with components/tokens from the design-system capability. No ad-hoc styles.
- **Dependencies**: `add-person-data-model`, `add-i18n-foundation`, `add-servant-auth`.
