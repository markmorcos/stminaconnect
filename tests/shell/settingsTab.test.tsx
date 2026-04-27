/**
 * Settings tab landing — Section 11.7.
 *
 *   - Servants see App + Sign Out only (no Admin section).
 *   - Admins see App + Admin (Counted Events, Alerts, Servants) + Sign Out.
 *   - Tapping Sign Out invokes useSignOutWithGuard().request().
 *
 * The tab landing imports TabHeader (with notifications bell + dev
 * kebab) and useSignOutWithGuard. We mock both to avoid wiring up
 * notifications / sync queue plumbing.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import SettingsTab from '@/../app/(app)/(tabs)/settings';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRequestSignOut = jest.fn();
jest.mock('@/components/SignOutDialog', () => ({
  useSignOutWithGuard: () => ({
    request: mockRequestSignOut,
    Dialog: () => null,
  }),
}));

jest.mock('@/components/TabHeader', () => ({
  TabHeader: ({ title }: { title: string }) => {
    const React = require('react');
    const RN = require('react-native');
    return React.createElement(RN.Text, { testID: 'tab-header' }, title);
  },
}));

let mockServantRow: { id: string; role: 'admin' | 'servant' } | null = null;
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    servant: mockServantRow,
    isLoading: false,
  }),
}));

function renderTab() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <SettingsTab />
      </ThemeProvider>
    </PaperProvider>,
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockRequestSignOut.mockReset();
  mockServantRow = null;
});

describe('Settings tab', () => {
  it('renders the App section + Sign Out for a servant', () => {
    mockServantRow = { id: 's1', role: 'servant' };
    const { getByText, queryByText } = renderTab();
    expect(getByText('App')).toBeTruthy();
    expect(getByText('Account')).toBeTruthy();
    expect(getByText('Language')).toBeTruthy();
    expect(getByText('About')).toBeTruthy();
    expect(getByText('Sign out')).toBeTruthy();
    expect(queryByText('Admin')).toBeNull();
    expect(queryByText('Counted events')).toBeNull();
    expect(queryByText('Servants')).toBeNull();
    expect(queryByText('Absence alerts')).toBeNull();
  });

  it('renders both App + Admin sections for an admin', () => {
    mockServantRow = { id: 'a1', role: 'admin' };
    const { getByText } = renderTab();
    expect(getByText('App')).toBeTruthy();
    expect(getByText('Account')).toBeTruthy();
    expect(getByText('Language')).toBeTruthy();
    expect(getByText('About')).toBeTruthy();
    expect(getByText('Admin')).toBeTruthy();
    expect(getByText('Counted events')).toBeTruthy();
    expect(getByText('Absence alerts')).toBeTruthy();
    expect(getByText('Servants')).toBeTruthy();
    expect(getByText('Sign out')).toBeTruthy();
  });

  it('navigates to /settings/account when Account row is tapped', () => {
    mockServantRow = { id: 's1', role: 'servant' };
    const { getByText } = renderTab();
    fireEvent.press(getByText('Account'));
    expect(mockPush).toHaveBeenCalledWith('/settings/account');
  });

  it('triggers the sign-out guard when Sign Out is tapped', () => {
    mockServantRow = { id: 's1', role: 'servant' };
    const { getByText } = renderTab();
    fireEvent.press(getByText('Sign out'));
    expect(mockRequestSignOut).toHaveBeenCalledTimes(1);
  });
});
