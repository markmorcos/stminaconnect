/**
 * About screen — renders all sections and exposes the dev-only
 * showcase navigation through long-press.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import About from '@/../app/(app)/about';
import '@/i18n';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '0.1.0',
    },
  },
}));

jest.mock('@/services/db/repositories/queueRepo', () => ({
  listNeedsAttention: jest.fn(async () => []),
}));

function renderAbout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider initialMode="light">
        <About />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('About screen', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders the app, church, credits, and links sections', () => {
    const { getByText } = renderAbout();
    expect(getByText('About')).toBeTruthy();
    expect(getByText('App')).toBeTruthy();
    expect(getByText('Church')).toBeTruthy();
    expect(getByText('Credits')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
    expect(getByText('Terms of Service')).toBeTruthy();
  });

  it('renders the version from expo-constants', () => {
    const { getByText } = renderAbout();
    expect(getByText('0.1.0')).toBeTruthy();
  });

  it('renders the required font / icon / UI library notices', () => {
    const { getByText } = renderAbout();
    expect(getByText(/Inter — SIL Open Font License/)).toBeTruthy();
    expect(getByText(/IBM Plex Sans Arabic — SIL Open Font License/)).toBeTruthy();
    expect(getByText(/Lucide — ISC License/)).toBeTruthy();
    expect(getByText(/React Native Paper — MIT License/)).toBeTruthy();
  });

  it('long-press on app identity navigates to /dev/showcase in dev', () => {
    const { getByLabelText } = renderAbout();
    const appCard = getByLabelText('App');
    fireEvent(appCard, 'longPress');
    expect(mockPush).toHaveBeenCalledWith('/dev/showcase');
  });
});
