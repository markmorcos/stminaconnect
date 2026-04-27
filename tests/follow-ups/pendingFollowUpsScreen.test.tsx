/**
 * Component test for the pending follow-ups screen (task 7.7).
 *
 * Verifies the three sections render their headers when data exists.
 */
import { render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PendingFollowUpsScreen } from '@/features/follow-up/PendingFollowUpsScreen';
import { ThemeProvider } from '@/design/ThemeProvider';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => false,
  }),
}));

const mockList = jest.fn();
jest.mock('@/services/api/followUps', () => ({
  listPendingFollowUps: (...args: unknown[]) => mockList(...args),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <PendingFollowUpsScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockList.mockReset();
});

describe('PendingFollowUpsScreen', () => {
  it('renders all three section headers when each has rows', async () => {
    mockList.mockResolvedValue([
      {
        section: 'needs_follow_up',
        follow_up_id: null,
        alert_id: 'a1',
        person_id: 'p1',
        person_first: 'Mariam',
        person_last: 'Saad',
        person_priority: 'high',
        action: null,
        notes: null,
        status: null,
        snooze_until: null,
        created_at: '2026-04-27T00:00:00Z',
        alert_streak: 3,
        alert_crossed_at: '2026-04-27T00:00:00Z',
      },
      {
        section: 'snoozed_returning',
        follow_up_id: 'f1',
        alert_id: null,
        person_id: 'p2',
        person_first: 'Mina',
        person_last: 'Ibrahim',
        person_priority: 'medium',
        action: 'called',
        notes: null,
        status: 'snoozed',
        snooze_until: '2026-04-28',
        created_at: '2026-04-25T00:00:00Z',
        alert_streak: null,
        alert_crossed_at: null,
      },
      {
        section: 'recent',
        follow_up_id: 'f2',
        alert_id: null,
        person_id: 'p3',
        person_first: 'Beshoy',
        person_last: 'Hanna',
        person_priority: 'low',
        action: 'texted',
        notes: 'Sent a prayer',
        status: 'completed',
        snooze_until: null,
        created_at: '2026-04-26T00:00:00Z',
        alert_streak: null,
        alert_crossed_at: null,
      },
    ]);
    const { findByText } = renderScreen();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(await findByText('Needs follow-up')).toBeTruthy();
    expect(await findByText('Returning today/tomorrow')).toBeTruthy();
    expect(await findByText('Recently logged')).toBeTruthy();
    expect(await findByText('Mariam Saad')).toBeTruthy();
    expect(await findByText('Mina Ibrahim')).toBeTruthy();
    expect(await findByText('Beshoy Hanna')).toBeTruthy();
  });

  it('renders the empty state when there are no rows', async () => {
    mockList.mockResolvedValue([]);
    const { findByText } = renderScreen();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(await findByText('All caught up.')).toBeTruthy();
  });
});
