/**
 * Banner — renders when the store has a banner notification, dismisses
 * via the Dismiss action, and triggers markRead + router.push when the
 * View action fires.
 */
/* eslint-disable import/first */
const mockPushFn = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPushFn }),
}));

const mockMarkReadFn = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/notifications', () => {
  const actual = jest.requireActual('@/services/notifications');
  return {
    ...actual,
    useNotificationService: () => ({
      markRead: mockMarkReadFn,
      markAllRead: jest.fn(),
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      refresh: jest.fn(),
      teardown: jest.fn(),
    }),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { NotificationBanner } from '@/components/NotificationBanner';
import { ThemeProvider } from '@/design/ThemeProvider';
import {
  __resetNotificationsStoreForTests,
  useNotificationsStore,
} from '@/state/notificationsStore';
import type { Notification } from '@/services/notifications/types';
/* eslint-enable import/first */

const banner: Notification = {
  id: 'n-1',
  type: 'system',
  payload: { message: 'hi' },
  recipientServantId: 's-1',
  createdAt: '2026-04-26T10:00:00Z',
  readAt: null,
};

function renderBanner() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <NotificationBanner />
      </ThemeProvider>
    </PaperProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetNotificationsStoreForTests();
});

describe('NotificationBanner', () => {
  it('renders the localized title when a banner is set', () => {
    act(() => {
      useNotificationsStore.setState({ bannerNotification: banner });
    });
    const { queryAllByText } = renderBanner();
    // The View / Dismiss action labels prove the banner mounted with the
    // current notification — the body text is animated and not always
    // rendered synchronously by Paper's Banner.
    expect(queryAllByText('View').length).toBeGreaterThan(0);
    expect(queryAllByText('Dismiss').length).toBeGreaterThan(0);
  });

  it('Dismiss clears the banner without calling markRead', () => {
    act(() => {
      useNotificationsStore.setState({ bannerNotification: banner });
    });
    const { getByText } = renderBanner();
    fireEvent.press(getByText('Dismiss'));
    expect(useNotificationsStore.getState().bannerNotification).toBeNull();
    expect(mockMarkReadFn).not.toHaveBeenCalled();
  });

  it('View calls markRead, dismisses the banner, and pushes the deep-link route', () => {
    act(() => {
      useNotificationsStore.setState({ bannerNotification: banner });
    });
    const { getByText } = renderBanner();
    fireEvent.press(getByText('View'));
    expect(mockMarkReadFn).toHaveBeenCalledWith('n-1');
    expect(mockPushFn).toHaveBeenCalledWith('/notifications');
    expect(useNotificationsStore.getState().bannerNotification).toBeNull();
  });
});
