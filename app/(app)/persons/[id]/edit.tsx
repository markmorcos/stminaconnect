/**
 * Profile edit — `/persons/[id]/edit`. Mounts the shared
 * FullRegistrationForm in `edit` (or `upgrade` when `?upgrade=true`)
 * mode, prefilled with the current person row.
 *
 * Field-level permissions are mirrored client-side (Priority + Assigned
 * Servant disabled for non-admins; Comments hidden for callers without
 * comment access). The RPC enforces the same rules server-side.
 */
import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { ErrorState, LoadingSkeleton, Stack } from '@/design';
import { FullRegistrationForm } from '@/features/registration/full/FullRegistrationForm';
import { getPerson } from '@/services/api/persons';

export default function EditPersonScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, upgrade } = useLocalSearchParams<{ id: string; upgrade?: string }>();
  const isUpgrade = upgrade === 'true' || upgrade === '1';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['person', id],
    queryFn: () => getPerson(id),
    enabled: typeof id === 'string' && id.length > 0,
  });

  if (isLoading) {
    return (
      <ScrollView>
        <Stack padding="lg" gap="md">
          <LoadingSkeleton height={56} radius="lg" />
          <LoadingSkeleton height={56} radius="lg" />
          <LoadingSkeleton height={56} radius="lg" />
          <LoadingSkeleton height={120} radius="lg" />
        </Stack>
      </ScrollView>
    );
  }

  if (isError || !data) {
    return <ErrorState title={t('persons.list.error')} />;
  }

  return (
    <FullRegistrationForm
      mode={isUpgrade ? 'upgrade' : 'edit'}
      person={data}
      onSubmitSuccess={() => {
        // The underlying profile is still on the stack; pop the edit
        // screen and let it re-render with the invalidated query.
        // `replace` would push a second profile entry, so back-pressing
        // on Android would surface the original profile beneath it.
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(`/persons/${data.id}`);
        }
      }}
    />
  );
}
