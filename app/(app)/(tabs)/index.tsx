import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { TabHeader } from '@/components/TabHeader';
import { useTokens } from '@/design';
import { AdminDashboard } from '@/features/admin-dashboard/AdminDashboard';
import { ServantHome } from '@/features/home/ServantHome';
import { useAuth } from '@/hooks/useAuth';

export default function HomeTab() {
  const { t } = useTranslation();
  const { colors } = useTokens();
  const { servant } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader title={t('home.title')} />
      {servant?.role === 'admin' ? <AdminDashboard /> : <ServantHome />}
    </View>
  );
}
