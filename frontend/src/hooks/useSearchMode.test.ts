import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSearchMode } from './useSearchMode';
import { SEARCH_MODE_STORAGE_KEY } from '@/types/search.types';

describe('useSearchMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should default to both mode', () => {
    const { result } = renderHook(() => useSearchMode());
    expect(result.current.mode).toBe('both');
  });

  it('should persist mode to localStorage', () => {
    const { result } = renderHook(() => useSearchMode());
    act(() => {
      result.current.setMode('location');
    });
    expect(localStorage.getItem(SEARCH_MODE_STORAGE_KEY)).toBe('location');
    expect(result.current.mode).toBe('location');
  });

  it('should load mode from localStorage', () => {
    localStorage.setItem(SEARCH_MODE_STORAGE_KEY, 'location');
    const { result } = renderHook(() => useSearchMode());
    expect(result.current.mode).toBe('location');
  });

  it('should load both mode from localStorage', () => {
    localStorage.setItem(SEARCH_MODE_STORAGE_KEY, 'both');
    const { result } = renderHook(() => useSearchMode());
    expect(result.current.mode).toBe('both');
  });

  it('should handle invalid localStorage value', () => {
    localStorage.setItem(SEARCH_MODE_STORAGE_KEY, 'invalid');
    const { result } = renderHook(() => useSearchMode());
    expect(result.current.mode).toBe('both'); // fallback to default
  });

  it('should handle localStorage getItem errors gracefully', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockGetItem = vi.spyOn(Storage.prototype, 'getItem');
    mockGetItem.mockImplementation(() => {
      throw new Error('localStorage disabled');
    });

    const { result } = renderHook(() => useSearchMode());
    expect(result.current.mode).toBe('both'); // graceful fallback
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to read search mode from localStorage:',
      expect.any(Error)
    );

    mockGetItem.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should handle localStorage setItem errors gracefully', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');
    mockSetItem.mockImplementation(() => {
      throw new Error('localStorage quota exceeded');
    });

    const { result } = renderHook(() => useSearchMode());

    act(() => {
      result.current.setMode('location');
    });

    // State should still update in-memory
    expect(result.current.mode).toBe('location');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to persist search mode to localStorage:',
      expect.any(Error)
    );

    mockSetItem.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should switch between all three modes correctly', () => {
    const { result } = renderHook(() => useSearchMode());

    expect(result.current.mode).toBe('both');

    act(() => {
      result.current.setMode('paf');
    });
    expect(result.current.mode).toBe('paf');

    act(() => {
      result.current.setMode('location');
    });
    expect(result.current.mode).toBe('location');

    act(() => {
      result.current.setMode('both');
    });
    expect(result.current.mode).toBe('both');
  });
});
