import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TabHeader } from '@/components/TabHeader';
import { useTokens } from '@/design';
import { PendingFollowUpsScreen } from '@/features/follow-up/PendingFollowUpsScreen';

export default function FollowUpsTab() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader title={t('followUps.pendingTitle')} />
      <PendingFollowUpsScreen />
    </View>
  );
}
