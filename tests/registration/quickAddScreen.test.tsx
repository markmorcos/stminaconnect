/**
 * Quick Add screen — verifies the five-field render, the form-local
 * language switch, and the duplicate / create branch of the submit
 * pipeline.
 *
 * The persons API is mocked so we can isolate UI behavior from
 * Supabase. expo-router's `useRouter` and `useLocalSearchParams` are
 * stubbed to assert navigation intent.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import QuickAddScreen from '@/../app/(app)/registration/quick-add';
import { ThemeProvider } from '@/design/ThemeProvider';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const mockFindPotentialDuplicate = jest.fn();
const mockCreatePerson = jest.fn();
const mockGetPerson = jest.fn();

jest.mock('@/services/api/persons', () => ({
  findPotentialDuplicate: (...args: unknown[]) => mockFindPotentialDuplicate(...args),
  createPerson: (...args: unknown[]) => mockCreatePerson(...args),
  getPerson: (...args: unknown[]) => mockGetPerson(...args),
}));

function renderScreen() {
  // `gcTime: 0` so query observers tear down synchronously on unmount.
  // Default is 5 minutes, which keeps a setTimeout alive past the test
  // and blocks jest-worker from exiting cleanly.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <QuickAddScreen />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  mockFindPotentialDuplicate.mockReset();
  mockCreatePerson.mockReset();
  mockGetPerson.mockReset();
});

describe('Quick Add screen', () => {
  it('renders the five fields', () => {
    const { getByLabelText, getByText } = renderScreen();
    expect(getByLabelText('First name')).toBeTruthy();
    expect(getByLabelText('Last name')).toBeTruthy();
    expect(getByLabelText('Phone')).toBeTruthy();
    expect(getByLabelText('Region (optional)')).toBeTruthy();
    expect(getByText('Preferred language')).toBeTruthy();
  });

  it('keeps form labels in the app language when a different language radio is tapped, but persists the chosen language on submit', async () => {
    mockFindPotentialDuplicate.mockResolvedValue(null);
    mockCreatePerson.mockResolvedValue('new-id');
    const { getByLabelText, getByText, queryByLabelText } = renderScreen();
    fireEvent.changeText(getByLabelText('First name'), 'Mariam');
    fireEvent.changeText(getByLabelText('Last name'), 'Habib');
    fireEvent.changeText(getByLabelText('Phone'), '+491701234567');
    fireEvent.press(getByText('العربية'));
    // The labels should stay in English — the radio captures the
    // newcomer's preferred language for the saved record only.
    expect(queryByLabelText('First name')).toBeTruthy();
    expect(queryByLabelText('الاسم الأول')).toBeNull();
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    await waitFor(() => expect(mockCreatePerson).toHaveBeenCalled());
    expect(mockCreatePerson.mock.calls[0][0]).toMatchObject({ language: 'ar' });
  });

  it('calls findPotentialDuplicate, then createPerson when no match', async () => {
    mockFindPotentialDuplicate.mockResolvedValue(null);
    mockCreatePerson.mockResolvedValue('new-id');
    const { getByLabelText, getByText } = renderScreen();
    fireEvent.changeText(getByLabelText('First name'), 'Mariam');
    fireEvent.changeText(getByLabelText('Last name'), 'Habib');
    fireEvent.changeText(getByLabelText('Phone'), '+491701234567');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    await waitFor(() => expect(mockFindPotentialDuplicate).toHaveBeenCalled());
    expect(mockFindPotentialDuplicate).toHaveBeenCalledWith('Mariam', 'Habib', '+491701234567');
    await waitFor(() => expect(mockCreatePerson).toHaveBeenCalled());
    const payload = mockCreatePerson.mock.calls[0][0];
    expect(payload).toMatchObject({
      first_name: 'Mariam',
      last_name: 'Habib',
      phone: '+491701234567',
      registration_type: 'quick_add',
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/',
        params: { welcome: 'Mariam' },
      }),
    );
  });

  it('opens the duplicate dialog when a match is returned', async () => {
    mockFindPotentialDuplicate.mockResolvedValue('existing-id');
    mockGetPerson.mockResolvedValue({
      id: 'existing-id',
      first_name: 'Mariam',
      last_name: 'Habib',
    });
    const { getByLabelText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByLabelText('First name'), 'Mariam');
    fireEvent.changeText(getByLabelText('Last name'), 'Habib');
    fireEvent.changeText(getByLabelText('Phone'), '+491701234567');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    expect(await findByText('Possible duplicate')).toBeTruthy();
    expect(mockCreatePerson).not.toHaveBeenCalled();
  });

  it('inline-validates an invalid phone number and does not submit', async () => {
    const { getByLabelText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByLabelText('First name'), 'Mariam');
    fireEvent.changeText(getByLabelText('Last name'), 'Habib');
    fireEvent.changeText(getByLabelText('Phone'), '0170 1234567');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    expect(await findByText('Invalid phone number')).toBeTruthy();
    expect(mockFindPotentialDuplicate).not.toHaveBeenCalled();
    expect(mockCreatePerson).not.toHaveBeenCalled();
  });
});
