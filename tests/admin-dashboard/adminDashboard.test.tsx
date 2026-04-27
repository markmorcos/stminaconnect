/**
 * AdminDashboard — Section 11.4.
 *
 *   - All five sections + the Quick Actions row render their titles
 *     when the RPCs return populated data.
 *   - The empty / zero data cases surface localized empty states
 *     (trend, funnel, regions, at-risk).
 *   - A failing RPC surfaces the per-section error placeholder with a
 *     Retry affordance — without breaking the other sections.
 *
 * The dashboard service module is mocked so each test controls per-RPC
 * resolved value. `react-native-chart-kit` requires `react-native-svg`,
 * which isn't loaded by the jest preset; we stub LineChart so renders
 * don't crash.
 */
import { render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AdminDashboard } from '@/features/admin-dashboard/AdminDashboard';
import { ThemeProvider } from '@/design/ThemeProvider';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Href: undefined,
}));

jest.mock('react-native-chart-kit', () => ({
  LineChart: () => {
    const React = require('react');
    const RN = require('react-native');
    return React.createElement(RN.Text, { testID: 'line-chart' }, 'line-chart');
  },
}));

const mockOverview = jest.fn();
const mockTrend = jest.fn();
const mockAtRisk = jest.fn();
const mockFunnel = jest.fn();
const mockRegions = jest.fn();

jest.mock('@/services/api/dashboard', () => ({
  fetchDashboardOverview: () => mockOverview(),
  fetchDashboardAttendanceTrend: (w?: number) => mockTrend(w),
  fetchDashboardAtRisk: () => mockAtRisk(),
  fetchDashboardNewcomerFunnel: (d?: number) => mockFunnel(d),
  fetchDashboardRegionBreakdown: (n?: number) => mockRegions(n),
}));

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <AdminDashboard />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockOverview.mockReset();
  mockTrend.mockReset();
  mockAtRisk.mockReset();
  mockFunnel.mockReset();
  mockRegions.mockReset();
});

describe('AdminDashboard', () => {
  it('renders all five section titles + the quick-actions row when populated', async () => {
    mockOverview.mockResolvedValue({
      totalMembers: 142,
      activeLast30: 87,
      newThisMonth: 5,
      avgAttendance4w: 38.5,
    });
    mockTrend.mockResolvedValue([
      {
        event_id: 'e1',
        event_title: 'Liturgy',
        start_at: '2026-04-20T08:00:00Z',
        attendee_count: 41,
      },
    ]);
    mockAtRisk.mockResolvedValue([
      {
        servant_id: 'svt1',
        servant_name: 'Mariam Habib',
        person_id: 'p1',
        person_name: 'John Doe',
        streak: 3,
        last_event_id: 'e1',
        last_event_title: 'Liturgy',
        last_event_at: '2026-04-20T08:00:00Z',
      },
    ]);
    mockFunnel.mockResolvedValue({ quickAdd: 10, upgraded: 6, active: 3 });
    mockRegions.mockResolvedValue([{ region: 'Schwabing', member_count: 12 }]);

    const { getByText } = renderDashboard();

    // Quick actions row
    expect(getByText('Check In')).toBeTruthy();
    expect(getByText('Quick Add')).toBeTruthy();
    expect(getByText('Register full')).toBeTruthy();

    await waitFor(() => expect(getByText('Total members')).toBeTruthy());
    expect(getByText('Attendance trend')).toBeTruthy();
    expect(getByText('At risk')).toBeTruthy();
    expect(getByText('Newcomer funnel (90 days)')).toBeTruthy();
    expect(getByText('Members by region')).toBeTruthy();
  });

  it('shows empty states when sections return zero data', async () => {
    mockOverview.mockResolvedValue({
      totalMembers: 0,
      activeLast30: 0,
      newThisMonth: 0,
      avgAttendance4w: 0,
    });
    mockTrend.mockResolvedValue([]);
    mockAtRisk.mockResolvedValue([]);
    mockFunnel.mockResolvedValue({ quickAdd: 0, upgraded: 0, active: 0 });
    mockRegions.mockResolvedValue([]);

    const { findByText } = renderDashboard();
    expect(await findByText('No counted events in this window.')).toBeTruthy();
    expect(await findByText('Nobody is at risk right now.')).toBeTruthy();
    expect(await findByText('No newcomers in the last 90 days.')).toBeTruthy();
    expect(await findByText('No region data yet.')).toBeTruthy();
  });

  it('shows an error placeholder for one failing section without breaking others', async () => {
    mockOverview.mockResolvedValue({
      totalMembers: 5,
      activeLast30: 2,
      newThisMonth: 1,
      avgAttendance4w: 0,
    });
    mockTrend.mockRejectedValue(new Error('boom'));
    mockAtRisk.mockResolvedValue([]);
    mockFunnel.mockResolvedValue({ quickAdd: 0, upgraded: 0, active: 0 });
    mockRegions.mockResolvedValue([]);

    const { findByText, getByText } = renderDashboard();
    expect(await findByText('Could not load this section.')).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
    // Other sections still render normally.
    expect(getByText('Total members')).toBeTruthy();
    expect(getByText('At risk')).toBeTruthy();
  });
});
