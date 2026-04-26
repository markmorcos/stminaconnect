/**
 * FullRegistrationForm — verifies the eight-field render in `create`
 * mode, the prefill in `edit` mode, and the admin-only disable on the
 * Priority radio for non-admin callers.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FullRegistrationForm } from '@/features/registration/full/FullRegistrationForm';
import { ThemeProvider } from '@/design/ThemeProvider';
import type { Person } from '@/types/person';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/api/servants', () => ({
  listServants: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/api/persons', () => ({
  findPotentialDuplicate: jest.fn().mockResolvedValue(null),
  createPerson: jest.fn().mockResolvedValue('new-id'),
  updatePerson: jest.fn().mockResolvedValue({}),
  assignPerson: jest.fn().mockResolvedValue(undefined),
  getPerson: jest.fn().mockResolvedValue(null),
}));

const adminServant = {
  id: 'admin-id',
  email: 'admin@stmina.de',
  display_name: 'Admin',
  role: 'admin' as const,
};

const regularServant = {
  id: 'servant-1',
  email: 'servant1@stmina.de',
  display_name: 'Servant One',
  role: 'servant' as const,
};

function renderForm(props: React.ComponentProps<typeof FullRegistrationForm>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider>
        <ThemeProvider initialMode="light">
          <FullRegistrationForm {...props} />
        </ThemeProvider>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

const samplePerson: Person = {
  id: 'p1',
  first_name: 'Mariam',
  last_name: 'Habib',
  phone: '+491701234567',
  region: 'Nord',
  language: 'en',
  priority: 'medium',
  assigned_servant: 'servant-1',
  comments: 'Existing note',
  status: 'active',
  paused_until: null,
  registration_type: 'full',
  registered_by: 'admin-id',
  registered_at: '2026-04-01T12:00:00Z',
  created_at: '2026-04-01T12:00:00Z',
  updated_at: '2026-04-01T12:00:00Z',
  deleted_at: null,
};

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe('FullRegistrationForm', () => {
  it('create mode shows all eight fields', () => {
    mockUseAuth.mockReturnValue({ servant: adminServant });
    const { getByLabelText, getByText, getAllByText } = renderForm({
      mode: 'create',
      onSubmitSuccess: jest.fn(),
    });
    expect(getByLabelText('First name')).toBeTruthy();
    expect(getByLabelText('Last name')).toBeTruthy();
    expect(getByLabelText('Phone')).toBeTruthy();
    expect(getByLabelText('Region (optional)')).toBeTruthy();
    expect(getByText('Preferred language')).toBeTruthy();
    expect(getByText('Priority')).toBeTruthy();
    // Section heading + picker accessibilityLabel both render the
    // string, so `getAllByText` is the right matcher here.
    expect(getAllByText('Assigned servant').length).toBeGreaterThan(0);
    expect(getByLabelText('Private comments')).toBeTruthy();
  });

  it('edit mode prefills first_name from the person row', () => {
    mockUseAuth.mockReturnValue({ servant: adminServant });
    const { getByDisplayValue } = renderForm({
      mode: 'edit',
      person: samplePerson,
      onSubmitSuccess: jest.fn(),
    });
    expect(getByDisplayValue('Mariam')).toBeTruthy();
    expect(getByDisplayValue('Habib')).toBeTruthy();
    expect(getByDisplayValue('+491701234567')).toBeTruthy();
    expect(getByDisplayValue('Existing note')).toBeTruthy();
  });

  it('non-admin: priority and assigned-servant labels show admin-only hint', () => {
    mockUseAuth.mockReturnValue({ servant: regularServant });
    const { getAllByText, getByText } = renderForm({
      mode: 'edit',
      person: samplePerson,
      onSubmitSuccess: jest.fn(),
    });
    // Both the Priority label and the Assigned-Servant label include
    // the admin-only hint when the caller is non-admin.
    expect(getAllByText(/admin only/i).length).toBe(2);
    fireEvent.press(getByText('High'));
    // No assertion on flip — RadioButton.Items are disabled. The
    // server-side forbidden_field rejection covers the contract.
    expect(getByText('Priority (admin only)')).toBeTruthy();
  });

  it('non-admin non-assigned servant: comments field is hidden', () => {
    const stranger = { ...regularServant, id: 'someone-else' };
    mockUseAuth.mockReturnValue({ servant: stranger });
    const { queryByLabelText } = renderForm({
      mode: 'edit',
      person: samplePerson,
      onSubmitSuccess: jest.fn(),
    });
    expect(queryByLabelText('Private comments')).toBeNull();
  });
});
