import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TabHeader } from '@/components/TabHeader';
import { useTokens } from '@/design';
import PersonsListScreen from '@/features/persons/PersonsListScreen';

export default function PersonsTab() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader title={t('persons.list.title')} />
      <PersonsListScreen />
    </View>
  );
}
