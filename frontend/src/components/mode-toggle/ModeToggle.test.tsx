import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ModeToggle } from './ModeToggle';
import { SEARCH_MODE_STORAGE_KEY } from '@/types/search.types';

describe('ModeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render all three mode buttons', () => {
    render(<ModeToggle />);
    expect(screen.getByText(/Both/i)).toBeInTheDocument();
    expect(screen.getByText(/PAF Database/i)).toBeInTheDocument();
    expect(screen.getByText(/AWS Location/i)).toBeInTheDocument();
  });

  it('should highlight Both mode by default', () => {
    render(<ModeToggle />);
    const bothButton = screen.getByRole('radio', { name: /Both/i });
    const pafButton = screen.getByRole('radio', { name: /PAF Database/i });
    const locationButton = screen.getByRole('radio', { name: /AWS Location/i });

    expect(bothButton).toHaveAttribute('aria-checked', 'true');
    expect(pafButton).toHaveAttribute('aria-checked', 'false');
    expect(locationButton).toHaveAttribute('aria-checked', 'false');
  });

  it('should switch mode on button click', () => {
    render(<ModeToggle />);
    const locationButton = screen.getByRole('radio', { name: /AWS Location/i });

    fireEvent.click(locationButton);

    expect(locationButton).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(SEARCH_MODE_STORAGE_KEY)).toBe('location');
  });

  it('should switch to PAF mode', () => {
    render(<ModeToggle />);
    const pafButton = screen.getByRole('radio', { name: /PAF Database/i });

    fireEvent.click(pafButton);

    expect(pafButton).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(SEARCH_MODE_STORAGE_KEY)).toBe('paf');
  });

  it('should switch back to Both mode', () => {
    render(<ModeToggle />);
    const pafButton = screen.getByRole('radio', { name: /PAF Database/i });
    const bothButton = screen.getByRole('radio', { name: /Both/i });

    fireEvent.click(pafButton);
    expect(pafButton).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(bothButton);
    expect(bothButton).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(SEARCH_MODE_STORAGE_KEY)).toBe('both');
  });

  it('should have accessible ARIA attributes', () => {
    render(<ModeToggle />);
    const container = screen.getByRole('radiogroup');
    expect(container).toHaveAttribute('aria-label', 'Select search data source');

    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(3);
  });

  it('should persist selection across re-renders', () => {
    const { unmount } = render(<ModeToggle />);
    const locationButton = screen.getByRole('radio', { name: /AWS Location/i });

    fireEvent.click(locationButton);
    unmount();

    // Re-render component
    render(<ModeToggle />);
    const newLocationButton = screen.getByRole('radio', { name: /AWS Location/i });
    expect(newLocationButton).toHaveAttribute('aria-checked', 'true');
  });

  it('should apply custom className', () => {
    const { container } = render(<ModeToggle className="custom-class" />);
    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).toHaveClass('custom-class');
  });
});
