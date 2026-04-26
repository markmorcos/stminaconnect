/**
 * Full Registration entry — `/registration/full`. Mounts the shared
 * form in `create` mode. Defaults the assigned-servant picker to the
 * current servant; admins can reassign before creating.
 *
 * Submit pipeline (handled inside the form / hook):
 *   1. RHF + Zod validate the eight fields.
 *   2. `find_potential_duplicate` runs the same soft-duplicate check
 *      as Quick Add. The dialog is rendered inside the form.
 *   3. `create_person({ ..., registration_type: 'full' })` writes the
 *      row.
 *   4. We navigate to the new profile (or, if the user picked
 *      "Use existing" in the duplicate dialog, to that profile).
 */
import { useRouter } from 'expo-router';

import { FullRegistrationForm } from '@/features/registration/full/FullRegistrationForm';

export default function FullRegistrationScreen() {
  const router = useRouter();
  return (
    <FullRegistrationForm
      mode="create"
      onSubmitSuccess={(result) => {
        // Navigate straight to the (new or chosen-existing) profile.
        // Unlike Quick Add (which returns to home for the next intake),
        // Full Registration is a deliberate long-form action, so the
        // profile view is the most useful next step.
        router.replace(`/persons/${result.personId}`);
      }}
    />
  );
}
