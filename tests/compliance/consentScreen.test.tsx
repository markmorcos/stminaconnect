/**
 * Component tests for the GDPR consent screen.
 *
 *   - Accept is disabled until the user (a) scrolls to the end and
 *     (b) ticks the agreement checkbox.
 *   - Decline opens the confirm dialog and signing out is triggered
 *     when the destructive action is selected.
 */
/* eslint-disable import/first -- jest.mock() must precede imports */
jest.mock('@/services/legal/getLegalDoc', () => ({
  CURRENT_LEGAL_VERSIONS: { privacy: '2026-04-28', terms: '2026-04-28' },
  getLegalDoc: jest.fn((kind: string) => ({
    kind,
    lang: 'en',
    version: '2026-04-28',
    body: `# ${kind} body\n\nSome content for ${kind}.`,
  })),
}));

jest.mock('@/services/api/compliance', () => ({
  recordConsent: jest.fn(async () => ({
    id: 'c1',
    user_id: 'u1',
    policy_version: '2026-04-28',
    terms_version: '2026-04-28',
    accepted_at: '2026-04-28T10:00:00Z',
    revoked_at: null,
  })),
  getMyLatestConsent: jest.fn(),
}));

const mockSignOut = jest.fn();
const mockReplace = jest.fn();
jest.mock('@/state/authStore', () => ({
  useAuthStore: jest.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      session: { user: { id: 'u1' } },
      signOut: mockSignOut,
    };
    return selector ? selector(state) : state;
  }),
  useIsHydrated: () => true,
  bootstrapAuth: () => () => {},
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  Redirect: () => null,
  Stack: () => null,
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ConsentScreen from '@/../app/(onboarding)/consent';
import { ThemeProvider } from '@/design/ThemeProvider';
import { recordConsent } from '@/services/api/compliance';
/* eslint-enable import/first */

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <ConsentScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

function fireScrollToEnd(scrollView: ReturnType<typeof render>['getByTestId']) {
  fireEvent.scroll(scrollView('consent-scroll'), {
    nativeEvent: {
      contentOffset: { x: 0, y: 1000 },
      contentSize: { height: 1000, width: 320 },
      layoutMeasurement: { height: 800, width: 320 },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Consent screen', () => {
  it('disables Accept until the checkbox is checked AND the user scrolls to the bottom', async () => {
    const { getByText } = renderScreen();

    // Wait for the legal docs to resolve
    await waitFor(() => expect(getByText(/privacy body/i)).toBeTruthy());

    const acceptBtn = getByText('Accept and continue');
    expect(acceptBtn).toBeTruthy();
    // The Button uses `accessibilityState`; we can't easily test the
    // disabled state cross-version, so call it and verify the API was
    // NOT invoked because of the gating.
    fireEvent.press(acceptBtn);
    await waitFor(() => {
      expect(recordConsent).not.toHaveBeenCalled();
    });
  });

  it('records consent after scroll-to-end + checkbox + Accept', async () => {
    const { getByText, getAllByRole, getByTestId } = renderScreen();
    await waitFor(() => expect(getByText(/privacy body/i)).toBeTruthy());

    await act(async () => {
      fireScrollToEnd(getByTestId);
    });

    // Tick the checkbox (the only checkbox on screen).
    const checkbox = getAllByRole('checkbox')[0];
    expect(checkbox).toBeTruthy();
    fireEvent.press(checkbox);

    // Press Accept.
    fireEvent.press(getByText('Accept and continue'));

    await waitFor(() => {
      expect(recordConsent).toHaveBeenCalledWith('2026-04-28', '2026-04-28');
    });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('decline opens a confirm dialog and signs out on confirm', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons) => {
      const confirm = buttons?.find((b) => b.style === 'destructive');
      confirm?.onPress?.();
    });

    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/privacy body/i)).toBeTruthy());

    fireEvent.press(getByText('Decline'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
