/**
 * Inbox screen — renders sectioned list, calls markRead on tap, and
 * fires markAllRead from the header action.
 */
/* eslint-disable import/first */
const mockPushFn = jest.fn();
const mockBackFn = jest.fn();
const mockReplaceFn = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPushFn,
    back: mockBackFn,
    canGoBack: () => false,
    replace: mockReplaceFn,
  }),
}));

const mockMarkReadFn = jest.fn().mockResolvedValue(undefined);
const mockMarkAllReadFn = jest.fn().mockResolvedValue(undefined);
const mockRefreshFn = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/notifications', () => {
  const actual = jest.requireActual('@/services/notifications');
  return {
    ...actual,
    useNotificationService: () => ({
      markRead: mockMarkReadFn,
      markAllRead: mockMarkAllReadFn,
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      refresh: mockRefreshFn,
      teardown: jest.fn(),
    }),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import NotificationsInbox from '@/../app/(app)/notifications';
import { ThemeProvider } from '@/design/ThemeProvider';
import {
  __resetNotificationsStoreForTests,
  useNotificationsStore,
} from '@/state/notificationsStore';
import type { Notification } from '@/services/notifications/types';
/* eslint-enable import/first */

const unread: Notification = {
  id: 'n-unread',
  type: 'system',
  payload: { message: 'hi' },
  recipientServantId: 's-1',
  createdAt: '2026-04-26T10:00:00Z',
  readAt: null,
};

const read: Notification = {
  id: 'n-read',
  type: 'system',
  payload: { message: 'old' },
  recipientServantId: 's-1',
  createdAt: '2026-04-26T09:00:00Z',
  readAt: '2026-04-26T09:30:00Z',
};

function renderInbox() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <NotificationsInbox />
      </ThemeProvider>
    </PaperProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetNotificationsStoreForTests();
});

describe('NotificationsInbox', () => {
  it('renders Unread and Read section headers when both are present', () => {
    act(() => {
      useNotificationsStore.getState().hydrate([unread, read], 1);
    });
    const { queryByText } = renderInbox();
    expect(queryByText('Unread')).toBeTruthy();
    expect(queryByText('Read')).toBeTruthy();
  });

  it('shows the empty state when the inbox is empty', () => {
    const { queryByText } = renderInbox();
    expect(queryByText('No notifications yet.')).toBeTruthy();
  });

  it('tapping a row calls markRead', () => {
    act(() => {
      useNotificationsStore.getState().hydrate([unread], 1);
    });
    const { getByLabelText } = renderInbox();
    fireEvent.press(getByLabelText('Notification'));
    expect(mockMarkReadFn).toHaveBeenCalledWith('n-unread');
  });

  it('Mark all read header action calls markAllRead', () => {
    act(() => {
      useNotificationsStore.getState().hydrate([unread], 1);
    });
    const { getByLabelText } = renderInbox();
    fireEvent.press(getByLabelText('Mark all read'));
    expect(mockMarkAllReadFn).toHaveBeenCalled();
  });
});
