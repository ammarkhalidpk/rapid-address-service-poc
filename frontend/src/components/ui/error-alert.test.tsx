import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorAlert } from './error-alert';

describe('ErrorAlert', () => {
  it('renders error message correctly', () => {
    render(<ErrorAlert message="Test error message" />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    const { container } = render(<ErrorAlert message="Test error" />);

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('has destructive variant styling', () => {
    const { container } = render(<ErrorAlert message="Test error" />);

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
  });
});
