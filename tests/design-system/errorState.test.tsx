/**
 * ErrorState — renders the title, optional body, and the optional
 * Retry button. Verifies the heading role and the retry callback.
 */
import { fireEvent, render } from '@testing-library/react-native';

import { ErrorState } from '@/design/components/ErrorState';
import { ThemeProvider } from '@/design/ThemeProvider';

function renderErrorState(node: React.ReactElement) {
  return render(<ThemeProvider initialMode="light">{node}</ThemeProvider>);
}

describe('ErrorState', () => {
  it('renders the title with a heading role', () => {
    const { getByRole } = renderErrorState(<ErrorState title="Could not load." />);
    const heading = getByRole('header');
    expect(heading).toBeTruthy();
  });

  it('renders the optional body when provided', () => {
    const { getByText } = renderErrorState(
      <ErrorState title="Could not load." body="Try again or refresh." />,
    );
    expect(getByText('Try again or refresh.')).toBeTruthy();
  });

  it('omits the retry button when no callback is provided', () => {
    const { queryByText } = renderErrorState(<ErrorState title="Could not load." />);
    expect(queryByText('Retry')).toBeNull();
  });

  it('shows the retry button and fires the callback on press', () => {
    const onRetry = jest.fn();
    const { getByText } = renderErrorState(
      <ErrorState title="Could not load." retryLabel="Retry" onRetry={onRetry} />,
    );
    fireEvent.press(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
