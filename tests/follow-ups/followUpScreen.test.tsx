/**
 * Component test for the follow-up form (task 7.6).
 *
 *   - Action chip is required → save without selection shows inline error.
 *   - status='snoozed' surfaces the snooze date picker affordance.
 *   - Happy path: action+notes+completed → createFollowUp called with payload.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FollowUpScreen } from '@/features/follow-up/FollowUpScreen';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

const mockCreate = jest.fn();
jest.mock('@/services/api/followUps', () => ({
  createFollowUp: (...args: unknown[]) => mockCreate(...args),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <FollowUpScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockBack.mockReset();
  mockCreate.mockReset();
});

describe('FollowUpScreen', () => {
  it('rejects save when no action is picked', async () => {
    const { getByText, findByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    expect(await findByText('Pick what you did.')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('reveals the snooze-date picker affordance when status=snoozed', () => {
    const { getByText, getByLabelText, queryByLabelText } = renderScreen();
    expect(queryByLabelText('Snooze until')).toBeNull();
    fireEvent.press(getByText('Snoozed'));
    expect(getByLabelText('Snooze until')).toBeTruthy();
  });

  it('calls createFollowUp with the payload when valid', async () => {
    mockCreate.mockResolvedValue({ id: 'f1' });
    const { getByText, getByLabelText } = renderScreen();
    fireEvent.press(getByText('Texted'));
    fireEvent.changeText(getByLabelText('Notes'), 'Sent a prayer');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      person_id: 'p1',
      action: 'texted',
      notes: 'Sent a prayer',
      status: 'completed',
      snooze_until: null,
    });
  });
});
