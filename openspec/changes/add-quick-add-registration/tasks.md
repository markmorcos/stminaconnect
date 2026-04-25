# Tasks — add-quick-add-registration

## 1. Server

- [ ] 1.1 Migration `005_find_potential_duplicate.sql`: RPC `find_potential_duplicate(first text, last text, phone text)` returning latest matching `persons.id` or null. ILIKE on names, exact match on phone. Excludes soft-deleted.
- [ ] 1.2 Update `create_person` RPC: when caller is non-admin and payload includes `assigned_servant`, ignore and substitute `auth.uid()`. When caller is admin, accept payload value.

## 2. Schema utility

- [ ] 2.1 `src/features/registration/schemas/quickAddSchema.ts`: Zod schema for the 5 fields per `design.md` §4.
- [ ] 2.2 Unit test: schema accepts valid payload; rejects empty names; rejects bad phone formats; rejects unknown language enum.

## 3. Form-local i18n context

- [ ] 3.1 `src/features/registration/QuickAddFormI18n.tsx`: a small wrapper around `<I18nextProvider>` exposing a fork of the global i18n instance with a per-form language. Rendered around the form's labels.
- [ ] 3.2 Helper hook `useFormLanguage()` returning `{ formLang, setFormLang }`.

## 4. Quick Add screen

- [ ] 4.1 `app/(app)/registration/_layout.tsx` — Stack header titled `t('registration.quickAdd.title')`.
- [ ] 4.2 `app/(app)/registration/quick-add.tsx`:
  - RHF `useForm` with the schema.
  - Fields rendered with Paper `TextInput` + `RadioButton.Group` for language.
  - Language radios: when tapped, also call `setFormLang` to switch the form's labels.
  - Phone field default value `+49 `.
  - Submit button disabled while `isSubmitting`.
- [ ] 4.3 On submit:
  - Call `findPotentialDuplicate(first, last, phone)`.
  - If a match: open Paper Dialog with two actions:
    - "Use existing" → `router.replace(/persons/[id])`.
    - "Save anyway" → close dialog, proceed.
  - If no match (or "Save anyway"): call `createPerson(payload)` with `registration_type: 'quick_add'`.
  - On success: navigate back to home; show Snackbar `t('registration.quickAdd.successWelcome', { firstName })`.
  - On error: keep form mounted, show Snackbar with translated error.

## 5. Home screen update

- [ ] 5.1 `app/(app)/index.tsx`: replace the temporary settings link with a tile-style layout. Primary tile: "Quick Add" → `router.push('/registration/quick-add')`. Secondary tile: "Persons list". (Settings and Sign Out remain accessible from a header menu.)

## 6. Translations

- [ ] 6.1 Extend `en.json` / `ar.json` / `de.json` with `registration.quickAdd.{title, firstName, lastName, phone, region, language, languageEN, languageAR, languageDE, save, successWelcome, errorGeneric, duplicateDialogTitle, duplicateDialogBody, useExisting, saveAnyway}`.
- [ ] 6.2 Verify key parity test passes.

## 7. Tests

- [ ] 7.1 Unit: schema validation cases.
- [ ] 7.2 Component: form renders 5 fields; tapping AR radio re-renders labels in Arabic; submit triggers `findPotentialDuplicate`; on null result, calls `createPerson`; on match, dialog appears.
- [ ] 7.3 Integration (against local Supabase): `find_potential_duplicate` returns null for empty DB; returns the row id when matching seed person exists; ignores soft-deleted matches.
- [ ] 7.4 Integration: `create_person` from a non-admin servant ignores supplied `assigned_servant` and uses caller; from an admin honours the payload.

## 8. Verification (in Expo Go)

- [ ] 8.1 Sign in as servant → tap Quick Add → fill form → submit → land on home with success snackbar.
- [ ] 8.2 Open `/persons` → new row visible at the top, assigned to the signed-in servant.
- [ ] 8.3 Re-open Quick Add → enter the same name+phone → duplicate dialog appears → "Use existing" navigates to the profile.
- [ ] 8.4 Tap Arabic radio mid-form → labels switch to Arabic, app shell labels remain in current app language.
- [ ] 8.5 Submit with bad phone → inline validation error.
- [ ] 8.6 `openspec validate add-quick-add-registration` passes.
