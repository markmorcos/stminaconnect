/**
 * ServantHome — covers tasks 6.4 and 6.5.
 *
 *   6.4 The home renders the four sections (quick actions + my group +
 *       pending follow-ups + recent newcomers) and visually flags Red /
 *       Yellow / Green / On break per the streakStatus rule.
 *   6.5 Pull-to-refresh triggers a refetch of every section's query.
 */
import { render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ServantHome } from '@/features/home/ServantHome';
import { ThemeProvider } from '@/design/ThemeProvider';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Href: undefined,
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ servant: { display_name: 'Mariam', email: 'm@x.test', role: 'servant' } }),
}));

const mockMyGroup = jest.fn();
const mockCount = jest.fn();
const mockNewcomers = jest.fn();
jest.mock('@/services/api/dashboard', () => {
  const actual = jest.requireActual('@/services/api/dashboard');
  return {
    ...actual,
    getMyGroup: () => mockMyGroup(),
    getPendingFollowupsCount: () => mockCount(),
    getRecentNewcomers: (d?: number) => mockNewcomers(d),
  };
});

const mockPending = jest.fn();
jest.mock('@/services/api/followUps', () => ({
  listPendingFollowUps: () => mockPending(),
}));

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <ServantHome />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockMyGroup.mockReset();
  mockCount.mockReset();
  mockNewcomers.mockReset();
  mockPending.mockReset();
});

const populatedMyGroup = [
  {
    person_id: 'p-red',
    first_name: 'Anna',
    last_name: 'Red',
    region: 'Schwabing',
    last_attendance_at: null,
    streak: 5,
    threshold: 3,
    status: 'active',
    paused_until: null,
    priority: 'medium',
  },
  {
    person_id: 'p-yellow',
    first_name: 'Boutros',
    last_name: 'Yellow',
    region: null,
    last_attendance_at: null,
    streak: 1,
    threshold: 3,
    status: 'active',
    paused_until: null,
    priority: 'medium',
  },
  {
    person_id: 'p-green',
    first_name: 'Cyrus',
    last_name: 'Green',
    region: 'Maxvorstadt',
    last_attendance_at: '2026-04-26T08:00:00Z',
    streak: 0,
    threshold: 3,
    status: 'active',
    paused_until: null,
    priority: 'medium',
  },
  {
    person_id: 'p-break',
    first_name: 'Demiana',
    last_name: 'Break',
    region: null,
    last_attendance_at: null,
    streak: 0,
    threshold: 3,
    status: 'on_break',
    paused_until: '2026-05-15',
    priority: 'medium',
  },
];

describe('ServantHome', () => {
  it('renders all four sections + the quick-actions row when populated (6.4)', async () => {
    mockMyGroup.mockResolvedValue(populatedMyGroup);
    mockCount.mockResolvedValue(2);
    mockPending.mockResolvedValue([
      {
        section: 'needs_follow_up',
        follow_up_id: null,
        alert_id: 'a1',
        person_id: 'p-red',
        person_first: 'Anna',
        person_last: 'Red',
        person_priority: 'medium',
        action: null,
        notes: null,
        status: null,
        snooze_until: null,
        created_at: '2026-04-27T08:00:00Z',
        alert_streak: 5,
        alert_crossed_at: '2026-04-27T08:00:00Z',
      },
    ]);
    mockNewcomers.mockResolvedValue([
      {
        person_id: 'n1',
        first_name: 'Newby',
        last_name: 'One',
        registered_at: '2026-04-26T09:00:00Z',
        registration_type: 'quick_add',
        region: null,
      },
    ]);

    const { getByText, findAllByText, queryAllByText } = renderHome();

    // Quick actions row (rendered synchronously).
    expect(getByText('Check In')).toBeTruthy();
    expect(getByText('Quick Add')).toBeTruthy();
    expect(getByText('Register full')).toBeTruthy();

    // Wait for each section's first data row to appear; titles render
    // during loading too, so we anchor on actual content. "Anna Red"
    // appears both in My Group and the follow-up preview, so use the
    // plural matcher.
    expect((await findAllByText('Anna Red')).length).toBeGreaterThan(0);
    expect((await findAllByText('Newby One')).length).toBeGreaterThan(0);

    // Other persons in My Group (Yellow, Green, On Break).
    expect(getByText('Boutros Yellow')).toBeTruthy();
    expect(getByText('Cyrus Green')).toBeTruthy();
    expect(getByText('Demiana Break')).toBeTruthy();

    // Section headings present.
    expect(getByText('My Group')).toBeTruthy();
    expect(getByText('Pending follow-ups')).toBeTruthy();
    expect(getByText('Recent newcomers')).toBeTruthy();

    // The On break badge appears for the on_break person.
    expect(queryAllByText('On break').length).toBeGreaterThan(0);
  });

  it('renders empty states when every section is empty', async () => {
    mockMyGroup.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockPending.mockResolvedValue([]);
    mockNewcomers.mockResolvedValue([]);

    const { findByText } = renderHome();
    expect(await findByText('Your group is fully checked in.')).toBeTruthy();
    expect(await findByText('No follow-ups pending.')).toBeTruthy();
    expect(await findByText('No new members in the last 30 days.')).toBeTruthy();
  });

  it('pull-to-refresh refetches every section (6.5)', async () => {
    mockMyGroup.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockPending.mockResolvedValue([]);
    mockNewcomers.mockResolvedValue([]);

    const { UNSAFE_getByType } = renderHome();

    await waitFor(() => expect(mockMyGroup).toHaveBeenCalledTimes(1));
    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockPending).toHaveBeenCalledTimes(1);
    expect(mockNewcomers).toHaveBeenCalledTimes(1);

    // ScrollView's RefreshControl onRefresh — invoke it directly. We
    // can't fire a real native gesture in jsdom, but we can locate the
    // RefreshControl prop and call it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RefreshControl } = require('react-native');
    const refreshControl = UNSAFE_getByType(RefreshControl);
    await refreshControl.props.onRefresh();

    await waitFor(() => expect(mockMyGroup).toHaveBeenCalledTimes(2));
    expect(mockCount).toHaveBeenCalledTimes(2);
    expect(mockPending).toHaveBeenCalledTimes(2);
    expect(mockNewcomers).toHaveBeenCalledTimes(2);
  });
});
