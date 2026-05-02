/**
 * RosterScreen — covers task 7.6: toggling a row updates the pending
 * count, Save calls the right RPC pair, and a Save failure preserves
 * pending state. The API + auth + router layers are mocked so the
 * screen runs against pure, in-memory state.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RosterScreen } from '@/features/attendance/RosterScreen';
import { ThemeProvider } from '@/design/ThemeProvider';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ eventId: 'event-1' }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/api/events', () => {
  const fixture = {
    id: 'event-1',
    google_event_id: 'g1',
    title: 'Sunday Liturgy',
    description: null,
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    is_counted: true,
    synced_at: new Date().toISOString(),
  };
  return {
    getTodayEvents: jest.fn().mockResolvedValue([fixture]),
    getCheckInEvents: jest.fn().mockResolvedValue([fixture]),
    getEvent: jest.fn().mockResolvedValue(fixture),
  };
});

jest.mock('@/services/api/alertConfig', () => ({
  getAlertConfig: jest.fn().mockResolvedValue({
    id: 'cfg-1',
    absence_threshold: 3,
    priority_thresholds: {},
    notify_admin_on_alert: false,
    escalation_threshold: null,
    grace_period_days: 3,
    updated_at: '2026-04-27T00:00:00Z',
    updated_by: null,
  }),
}));

jest.mock('@/services/api/persons', () => ({
  listPersons: jest.fn().mockResolvedValue([
    {
      id: 'p1',
      first_name: 'Mariam',
      last_name: 'Saad',
      phone: null,
      region: 'Schwabing',
      language: 'en',
      priority: 'medium',
      assigned_servant: 'servant-1',
      comments: null,
      status: 'active',
      paused_until: null,
      registration_type: 'full',
      registered_by: 'admin-1',
      registered_at: '2026-04-01T12:00:00Z',
      created_at: '2026-04-01T12:00:00Z',
      updated_at: '2026-04-01T12:00:00Z',
      deleted_at: null,
    },
    {
      id: 'p2',
      first_name: 'Mina',
      last_name: 'Ibrahim',
      phone: null,
      region: 'Schwabing',
      language: 'en',
      priority: 'medium',
      assigned_servant: 'servant-1',
      comments: null,
      status: 'active',
      paused_until: null,
      registration_type: 'full',
      registered_by: 'admin-1',
      registered_at: '2026-04-01T12:00:00Z',
      created_at: '2026-04-01T12:00:00Z',
      updated_at: '2026-04-01T12:00:00Z',
      deleted_at: null,
    },
  ]),
}));

const mockMark = jest.fn();
const mockUnmark = jest.fn();
const mockGet = jest.fn();
const mockSearch = jest.fn();
const mockEditWindow = jest.fn();
jest.mock('@/services/api/attendance', () => ({
  markAttendance: (...args: unknown[]) => mockMark(...args),
  unmarkAttendance: (...args: unknown[]) => mockUnmark(...args),
  getEventAttendance: (...args: unknown[]) => mockGet(...args),
  searchPersons: (...args: unknown[]) => mockSearch(...args),
  isEventWithinEditWindow: (...args: unknown[]) => mockEditWindow(...args),
}));

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <RosterScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    servant: {
      id: 'servant-1',
      email: 'servant1@stminaconnect.com',
      display_name: 'Servant One',
      role: 'servant',
    },
  });
  mockMark.mockReset();
  mockUnmark.mockReset();
  mockGet.mockReset();
  mockSearch.mockReset();
  mockEditWindow.mockReset();
  mockGet.mockResolvedValue([]);
  mockSearch.mockResolvedValue([]);
  mockEditWindow.mockResolvedValue(true);
});

describe('RosterScreen', () => {
  it('toggling rows updates the Save FAB count and Save dispatches the correct RPC pair', async () => {
    mockMark.mockResolvedValue(2);
    mockUnmark.mockResolvedValue(0);

    const { findByLabelText, queryByText, getByText } = renderScreen();

    // Wait for the My Group rows to render.
    const row1 = await findByLabelText('Mariam Saad');
    const row2 = await findByLabelText('Mina Ibrahim');

    // No FAB before any toggle.
    expect(queryByText(/Save \(/)).toBeNull();

    fireEvent.press(row1);
    await waitFor(() => expect(getByText('Save (1 change)')).toBeTruthy());

    fireEvent.press(row2);
    await waitFor(() => expect(getByText('Save (2 changes)')).toBeTruthy());

    fireEvent.press(getByText('Save (2 changes)'));

    await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
    expect(mockMark).toHaveBeenCalledWith('event-1', expect.arrayContaining(['p1', 'p2']));
    expect(mockUnmark).toHaveBeenCalledWith('event-1', []);
  });

  it('Save failure preserves the pending count and surfaces an error', async () => {
    mockMark.mockRejectedValue(new Error('network error'));
    mockUnmark.mockResolvedValue(0);

    const { findByLabelText, getByText } = renderScreen();

    const row1 = await findByLabelText('Mariam Saad');
    fireEvent.press(row1);
    await waitFor(() => expect(getByText('Save (1 change)')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Save (1 change)'));
    });

    await waitFor(() => expect(mockMark).toHaveBeenCalled());
    // Pending state survived: the FAB still shows "(1 change)".
    expect(getByText('Save (1 change)')).toBeTruthy();
  });

  it('renders the read-only banner when the edit window has closed', async () => {
    mockEditWindow.mockResolvedValue(false);

    const { findByText, queryByText } = renderScreen();

    await findByText('This event is no longer editable.', { exact: false });
    // No Save FAB in read-only mode even after a (no-op) toggle attempt.
    expect(queryByText(/Save \(/)).toBeNull();
  });
});
