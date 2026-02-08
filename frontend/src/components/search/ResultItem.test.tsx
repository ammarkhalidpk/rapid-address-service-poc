import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PafResultItem, AwsResultItem } from './ResultItem';
import type { PafAddressResult, LocationResult } from '@/types';

describe('PafResultItem', () => {
  const mockResult: PafAddressResult = {
    id: '1',
    address: '123 George Street',
    addressShort: '123 George St',
    suburb: 'Sydney',
    postcode: '2000',
    state: 'NSW',
    street: 'George Street',
    streetNumber: '123',
    unit: '',
    buildingName: '',
    score: 100,
  };

  it('renders PAF result with correct data', () => {
    render(<PafResultItem result={mockResult} />);

    expect(screen.getByText('123 George Street')).toBeInTheDocument();
    expect(screen.getByText(/Sydney, NSW 2000/)).toBeInTheDocument();
    expect(screen.getByText('PAF')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<PafResultItem result={mockResult} onClick={onClick} />);

    fireEvent.click(screen.getByText('123 George Street'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows selected state when isSelected=true', () => {
    const { container } = render(<PafResultItem result={mockResult} isSelected={true} />);

    const resultDiv = container.querySelector('[role="option"]');
    expect(resultDiv).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(resultDiv).toHaveAttribute('aria-selected', 'true');
  });

  it('has correct aria attributes', () => {
    const { container } = render(<PafResultItem result={mockResult} isSelected={false} />);

    const resultDiv = container.querySelector('[role="option"]');
    expect(resultDiv).toHaveAttribute('role', 'option');
    expect(resultDiv).toHaveAttribute('aria-selected', 'false');
    expect(resultDiv).toHaveAttribute('tabIndex', '-1');
  });
});

describe('AwsResultItem', () => {
  const mockResult: LocationResult = {
    text: '123 George Street, Sydney NSW 2000, Australia',
    placeId: 'aws-place-123',
  };

  it('renders AWS result with correct data', () => {
    render(<AwsResultItem result={mockResult} />);

    expect(screen.getByText('123 George Street, Sydney NSW 2000, Australia')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<AwsResultItem result={mockResult} onClick={onClick} />);

    fireEvent.click(screen.getByText(mockResult.text));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows selected state when isSelected=true', () => {
    const { container } = render(<AwsResultItem result={mockResult} isSelected={true} />);

    const resultDiv = container.querySelector('[role="option"]');
    expect(resultDiv).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(resultDiv).toHaveAttribute('aria-selected', 'true');
  });
});
