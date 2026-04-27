/**
 * Home tab role branching — Section 11.6.
 *
 *   - Admin role → renders <AdminDashboard />.
 *   - Servant role → renders <ServantHome />.
 *
 * Both child components are stubbed so the test isolates the routing
 * decision (which one is mounted) from their content.
 */
import { render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import HomeTab from '@/../app/(app)/(tabs)/index';
import { ThemeProvider } from '@/design/ThemeProvider';

jest.mock('@/components/TabHeader', () => ({
  TabHeader: ({ title }: { title: string }) => {
    const React = require('react');
    const RN = require('react-native');
    return React.createElement(RN.Text, { testID: 'tab-header' }, title);
  },
}));

jest.mock('@/features/admin-dashboard/AdminDashboard', () => ({
  AdminDashboard: () => {
    const React = require('react');
    const RN = require('react-native');
    return React.createElement(RN.Text, { testID: 'admin-dashboard-stub' }, 'admin');
  },
}));

jest.mock('@/features/home/ServantHome', () => ({
  ServantHome: () => {
    const React = require('react');
    const RN = require('react-native');
    return React.createElement(RN.Text, { testID: 'servant-home-stub' }, 'servant');
  },
}));

let mockServantRow: { id: string; role: 'admin' | 'servant' } | null = null;
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ servant: mockServantRow, isLoading: false }),
}));

function renderTab() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <HomeTab />
      </ThemeProvider>
    </PaperProvider>,
  );
}

beforeEach(() => {
  mockServantRow = null;
});

describe('Home tab', () => {
  it('renders <AdminDashboard /> when role is admin', () => {
    mockServantRow = { id: 'a1', role: 'admin' };
    const { getByTestId, queryByTestId } = renderTab();
    expect(getByTestId('admin-dashboard-stub')).toBeTruthy();
    expect(queryByTestId('servant-home-stub')).toBeNull();
  });

  it('renders <ServantHome /> when role is servant', () => {
    mockServantRow = { id: 's1', role: 'servant' };
    const { getByTestId, queryByTestId } = renderTab();
    expect(getByTestId('servant-home-stub')).toBeTruthy();
    expect(queryByTestId('admin-dashboard-stub')).toBeNull();
  });

  it('renders <ServantHome /> when servant row is null (no role)', () => {
    mockServantRow = null;
    const { getByTestId } = renderTab();
    expect(getByTestId('servant-home-stub')).toBeTruthy();
  });
});
