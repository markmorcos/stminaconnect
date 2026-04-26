/**
 * Component test for the sign-out guard dialog. When the queue is
 * empty, `request()` invokes `authStore.signOut` directly. When the
 * queue is non-empty, the Paper Dialog appears and "Logout anyway"
 * clears the queue + signs out.
 */
/* eslint-disable import/first */
const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock('@/state/authStore', () => ({
  useAuthStore: jest.fn((selector?: (s: unknown) => unknown) => {
    const state = { signOut: mockSignOut };
    return selector ? selector(state) : state;
  }),
}));

let mockQueueLength = 0;
const mockClearQueue = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/db/repositories/queueRepo', () => ({
  length: jest.fn(async () => mockQueueLength),
  clearQueue: () => mockClearQueue(),
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Button, Provider as PaperProvider } from 'react-native-paper';

import { useSignOutWithGuard } from '@/components/SignOutDialog';
import { ThemeProvider } from '@/design/ThemeProvider';
/* eslint-enable import/first */

function Harness() {
  const guard = useSignOutWithGuard();
  return (
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <Button onPress={guard.request} accessibilityLabel="trigger">
          trigger
        </Button>
        <Text>idle</Text>
        <guard.Dialog />
      </ThemeProvider>
    </PaperProvider>
  );
}

describe('useSignOutWithGuard', () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockClearQueue.mockClear();
    mockQueueLength = 0;
  });

  it('signs out immediately when the queue is empty', async () => {
    mockQueueLength = 0;
    const { getByLabelText } = render(<Harness />);
    fireEvent.press(getByLabelText('trigger'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(mockClearQueue).not.toHaveBeenCalled();
  });

  it('shows the dialog and waits when the queue is non-empty; "Logout anyway" clears + signs out', async () => {
    mockQueueLength = 3;
    const { getByLabelText, findByText, getByText } = render(<Harness />);
    fireEvent.press(getByLabelText('trigger'));

    // Title appears.
    expect(await findByText('Unsynced changes')).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();

    // Logout anyway → clearQueue then signOut.
    await act(async () => {
      fireEvent.press(getByText('Logout anyway'));
    });
    await waitFor(() => expect(mockClearQueue).toHaveBeenCalled());
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('Stay logged in dismisses the dialog without signing out', async () => {
    mockQueueLength = 2;
    const { getByLabelText, findByText, getByText, queryByText } = render(<Harness />);
    fireEvent.press(getByLabelText('trigger'));
    expect(await findByText('Unsynced changes')).toBeTruthy();
    fireEvent.press(getByText('Stay logged in'));
    await waitFor(() => expect(queryByText('Unsynced changes')).toBeNull());
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
