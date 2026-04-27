/**
 * TabHeader — Section 11.8.
 *
 *   - Renders title + notifications bell.
 *   - Bell badge reflects the unread count from notificationsStore.
 *   - Bell with zero unread renders no badge.
 *   - Dev kebab menu (when `SHOW_DEV_TOOLS=true`): contains exactly
 *     DB Inspector + Showcase, no user-facing entries.
 *   - The kebab is absent when `SHOW_DEV_TOOLS=false` (production).
 *
 * The dev-tools flag lives in its own tiny module so we can mock it
 * without touching `__DEV__` or doing `jest.resetModules()` (which
 * would tear down React's context and break hooks).
 */
import { fireEvent, render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { TabHeader } from '@/components/TabHeader';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

interface NotificationsState {
  unreadCount: number;
}
const mockUnread = { count: 0 };
jest.mock('@/state/notificationsStore', () => ({
  useNotificationsStore: <T,>(selector: (s: NotificationsState) => T): T =>
    selector({ unreadCount: mockUnread.count }),
}));

const mockShowDevTools = { value: true };
jest.mock('@/components/devToolsFlag', () => ({
  get SHOW_DEV_TOOLS() {
    return mockShowDevTools.value;
  },
}));

function renderHeader(title = 'Home') {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <TabHeader title={title} />
      </ThemeProvider>
    </PaperProvider>,
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockUnread.count = 0;
  mockShowDevTools.value = true;
});

describe('TabHeader', () => {
  it('renders the title and the notifications bell', () => {
    const { getByText, getByLabelText } = renderHeader('Home');
    expect(getByText('Home')).toBeTruthy();
    expect(getByLabelText('Notifications')).toBeTruthy();
  });

  it('renders the unread badge when count > 0', () => {
    mockUnread.count = 3;
    const { getByLabelText, getByText } = renderHeader();
    expect(getByLabelText('3 unread')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('omits the unread badge when count is 0', () => {
    const { queryByLabelText } = renderHeader();
    expect(queryByLabelText('0 unread')).toBeNull();
  });

  it('clamps the badge label to 99+ above 99 unread', () => {
    mockUnread.count = 142;
    const { getByLabelText, getByText } = renderHeader();
    expect(getByLabelText('142 unread')).toBeTruthy();
    expect(getByText('99+')).toBeTruthy();
  });

  it('navigates to /notifications when the bell is tapped', () => {
    const { getByLabelText } = renderHeader();
    fireEvent.press(getByLabelText('Notifications'));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('renders the dev kebab with only DB Inspector + Showcase entries', () => {
    mockShowDevTools.value = true;
    const { getByLabelText, getByText, queryByText } = renderHeader();
    fireEvent.press(getByLabelText('Menu'));
    expect(getByText('DB Inspector')).toBeTruthy();
    expect(getByText('Showcase')).toBeTruthy();
    // Old user-facing kebab entries must not appear.
    expect(queryByText('About')).toBeNull();
    expect(queryByText('Settings')).toBeNull();
    expect(queryByText('Account')).toBeNull();
    expect(queryByText('Sign out')).toBeNull();
  });

  it('omits the kebab entirely when SHOW_DEV_TOOLS is false (production)', () => {
    mockShowDevTools.value = false;
    const { queryByLabelText } = renderHeader();
    expect(queryByLabelText('Menu')).toBeNull();
  });
});
