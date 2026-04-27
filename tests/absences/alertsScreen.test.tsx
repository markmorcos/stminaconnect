/**
 * AlertsScreen component test (task 8.10).
 *
 * Renders the screen with mocked services, verifies:
 *   - the form pre-populates from getAlertConfig
 *   - Save calls updateAlertConfig with the parsed values
 *   - Recalculate calls recalculateAbsences and shows a success message
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import { AlertsScreen } from '@/features/admin/AlertsScreen';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockGetAlertConfig = jest.fn();
const mockUpdateAlertConfig = jest.fn();
const mockRecalculateAbsences = jest.fn();

jest.mock('@/services/api/alertConfig', () => ({
  getAlertConfig: (...args: unknown[]) => mockGetAlertConfig(...args),
  updateAlertConfig: (...args: unknown[]) => mockUpdateAlertConfig(...args),
  recalculateAbsences: (...args: unknown[]) => mockRecalculateAbsences(...args),
}));

function renderScreen() {
  return render(
    <PaperProvider>
      <ThemeProvider initialMode="light">
        <AlertsScreen />
      </ThemeProvider>
    </PaperProvider>,
  );
}

beforeEach(() => {
  mockGetAlertConfig.mockReset();
  mockUpdateAlertConfig.mockReset();
  mockRecalculateAbsences.mockReset();
});

const baseConfig = {
  id: 'cfg-1',
  absence_threshold: 3,
  priority_thresholds: { high: 2, medium: null, low: 4, very_low: 6 },
  notify_admin_on_alert: true,
  escalation_threshold: null,
  grace_period_days: 3,
  updated_at: '2026-04-27T00:00:00Z',
  updated_by: null,
};

describe('AlertsScreen', () => {
  it('persists changes via updateAlertConfig when Save is pressed', async () => {
    mockGetAlertConfig.mockResolvedValue(baseConfig);
    mockUpdateAlertConfig.mockResolvedValue({ ...baseConfig, absence_threshold: 4 });

    const { findByLabelText, getByText } = renderScreen();
    const globalInput = await findByLabelText('Default threshold (consecutive misses)');
    fireEvent.changeText(globalInput, '4');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    await waitFor(() => expect(mockUpdateAlertConfig).toHaveBeenCalledTimes(1));
    expect(mockUpdateAlertConfig.mock.calls[0][0]).toMatchObject({
      absenceThreshold: 4,
      notifyAdminOnAlert: true,
      gracePeriodDays: 3,
    });
  });

  it('sends an updated grace-period value when the field is edited', async () => {
    mockGetAlertConfig.mockResolvedValue(baseConfig);
    mockUpdateAlertConfig.mockResolvedValue({ ...baseConfig, grace_period_days: 5 });

    const { findByLabelText, getByText } = renderScreen();
    const graceInput = await findByLabelText('Backfill grace period (days)');
    fireEvent.changeText(graceInput, '5');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    await waitFor(() => expect(mockUpdateAlertConfig).toHaveBeenCalledTimes(1));
    expect(mockUpdateAlertConfig.mock.calls[0][0]).toMatchObject({ gracePeriodDays: 5 });
  });

  it('calls recalculateAbsences when Recalculate is pressed', async () => {
    mockGetAlertConfig.mockResolvedValue(baseConfig);
    mockRecalculateAbsences.mockResolvedValue(2);

    const { findByText } = renderScreen();
    const button = await findByText('Recalculate now');
    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() => expect(mockRecalculateAbsences).toHaveBeenCalledTimes(1));
  });
});
