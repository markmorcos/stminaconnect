# Tasks — add-quick-add-registration

## 1. Server

- [x] 1.1 Migration `005_find_potential_duplicate.sql`: RPC `find_potential_duplicate(first text, last text, phone text)` returning latest matching `persons.id` or null. ILIKE on names, exact match on phone. Excludes soft-deleted.
- [x] 1.2 Update `create_person` RPC: when caller is non-admin and payload includes `assigned_servant`, ignore and substitute `auth.uid()`. When caller is admin, accept payload value.

## 2. Schema utility

- [x] 2.1 `src/features/registration/schemas/quickAddSchema.ts`: Zod schema for the 5 fields per `design.md` §4.
- [x] 2.2 Unit test: schema accepts valid payload; rejects empty names; rejects bad phone formats; rejects unknown language enum.

## 3. Quick Add screen

- [x] 3.1 `app/(app)/registration/_layout.tsx` — Stack header titled `t('registration.quickAdd.title')`.
- [x] 3.2 `app/(app)/registration/quick-add.tsx`:
  - RHF `useForm` with the schema.
  - Fields rendered with Paper `TextInput` + `RadioButton.Group` for language.
  - Language radio updates the form's `language` field only; labels stay in the app language.
  - Phone field default value `+49 `.
  - Submit button disabled while `isSubmitting`.
- [x] 3.3 On submit:
  - Call `findPotentialDuplicate(first, last, phone)`.
  - If a match: open Paper Dialog with two actions:
    - "Use existing" → `router.replace(/persons/[id])`.
    - "Save anyway" → close dialog, proceed.
  - If no match (or "Save anyway"): call `createPerson(payload)` with `registration_type: 'quick_add'`.
  - On success: navigate back to home; show Snackbar `t('registration.quickAdd.successWelcome', { firstName })`.
  - On error: keep form mounted, show Snackbar with translated error.

## 4. Home screen update

- [x] 4.1 `app/(app)/index.tsx`: replace the temporary settings link with a tile-style layout. Primary tile: "Quick Add" → `router.push('/registration/quick-add')`. Secondary tile: "Persons list". (Settings and Sign Out remain accessible from a header menu.)

## 5. Translations

- [x] 5.1 Extend `en.json` / `ar.json` / `de.json` with `registration.quickAdd.{title, firstName, lastName, phone, region, language, languageEN, languageAR, languageDE, save, successWelcome, errorGeneric, duplicateDialogTitle, duplicateDialogBody, useExisting, saveAnyway}`.
- [x] 5.2 Verify key parity test passes.

## 6. Tests

- [x] 6.1 Unit: schema validation cases.
- [x] 6.2 Component: form renders 5 fields; tapping AR radio leaves labels in the app language but persists `language: 'ar'` in the create payload; submit triggers `findPotentialDuplicate`; on null result, calls `createPerson`; on match, dialog appears.
- [x] 6.3 Integration (against local Supabase): `find_potential_duplicate` returns null for empty DB; returns the row id when matching seed person exists; ignores soft-deleted matches.
- [x] 6.4 Integration: `create_person` from a non-admin servant ignores supplied `assigned_servant` and uses caller; from an admin honours the payload.

## 7. Verification (in Expo Go)

- [x] 7.1 Sign in as servant → tap Quick Add → fill form → submit → land on home with success snackbar.
- [x] 7.2 Open `/persons` → new row visible at the top, assigned to the signed-in servant.
- [x] 7.3 Re-open Quick Add → enter the same name+phone → duplicate dialog appears → "Use existing" navigates to the profile.
- [x] 7.4 Tap Arabic radio mid-form → labels stay in the app language, but the saved person row has `language = 'ar'`.
- [x] 7.5 Submit with bad phone → inline validation error.
- [x] 7.6 `openspec validate add-quick-add-registration` passes.
