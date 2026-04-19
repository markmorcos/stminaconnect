## 1. Validation & domain logic

- [ ] 1.1 Add `features/registration/validators.ts` with Zod schemas for `quickAddInput`: `firstName`, `lastName`, `phone` (E.164 regex), `region` (optional), `language` (enum)
- [ ] 1.2 Add `features/registration/normalize.ts` with `normalizePhone(raw, defaultCountry = 'DE')` returning E.164
- [ ] 1.3 Unit tests covering valid/invalid phones, missing names, trimming whitespace, normalizing German local numbers to +49

## 2. i18n minimal

- [ ] 2.1 Install `i18next` + `react-i18next`; create `src/i18n/index.ts` bootstrap (device-locale detection, fallback = `en`)
- [ ] 2.2 Add `src/i18n/locales/{en,ar,de}/registration.json` with only the keys needed for Quick Add screen
- [ ] 2.3 Add `src/i18n/locales/{en,ar,de}/common.json` with keys used by Quick Add ("Save", "Cancel", "Error", "Retry")
- [ ] 2.4 Wire i18n provider into `app/_layout.tsx`
- [ ] 2.5 Document that the broader i18n story (language switcher, RTL logic) lands in `add-i18n-foundation`

## 3. UI

- [ ] 3.1 Home tab: add a prominent "Quick Add" primary-action button above the fold
- [ ] 3.2 `app/quick-add.tsx` screen: scrollable form with 5 fields, Save button in header
- [ ] 3.3 Integrate phone input component with `+49` default; format on blur
- [ ] 3.4 Language selector as segmented control (3 buttons)
- [ ] 3.5 Submit button: disabled while form invalid or request in-flight; spinner while submitting
- [ ] 3.6 Success: haptic + toast + navigate back to home
- [ ] 3.7 Failure (network): inline banner at top of form with retry button; form values preserved
- [ ] 3.8 Offline detection: if `NetInfo` shows offline, show an amber banner "You are offline — saving will fail. Try again when connected." (Actual offline queueing is added later.)

## 4. Duplicate detection

- [ ] 4.1 On phone field blur (with valid phone), call `list_persons({ phone: normalized, limit: 1 })`
- [ ] 4.2 If match found, show a bottom sheet with the match's name + "View existing" / "Continue anyway"
- [ ] 4.3 "View existing" navigates to Person detail (screen stub for now — real detail lands in `add-full-registration`)
- [ ] 4.4 "Continue anyway" dismisses and allows submit
- [ ] 4.5 Tests for bottom-sheet behavior

## 5. Mutations

- [ ] 5.1 `features/registration/hooks/use-create-person.ts`: TanStack Query mutation calling `createPerson` with `registration_type: 'quick_add'` and `assigned_servant_id: <session user id>`
- [ ] 5.2 On success, invalidate `['persons', ...]` queries
- [ ] 5.3 Error handling: classify network vs validation vs server error; map to i18n keys

## 6. Verification

- [ ] 6.1 RTL tests: form submission with valid data calls `createPerson`; invalid phone shows inline error; duplicate warning flow
- [ ] 6.2 Manual: fill in English, Arabic, German — each flows correctly
- [ ] 6.3 Manual: airplane mode → form submit → amber banner + failure state as designed
- [ ] 6.4 `make test`, `make lint`, `make typecheck` pass
- [ ] 6.5 `openspec validate add-quick-add-registration` passes
- [ ] 6.6 Manual: walk every scenario in `specs/registration/spec.md`
