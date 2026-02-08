import { useState, useEffect, useCallback } from 'react';
import type { PafSearchResponse, LocationSuggestResponse, PafAddressResult, LocationResult } from '@/types';
import type { SearchMode } from '@/types/search.types';

interface UseKeyboardNavigationParams {
  isDropdownOpen: boolean;
  mode: SearchMode;
  pafData: PafSearchResponse | undefined;
  awsData: LocationSuggestResponse | undefined;
  debouncedQuery: string;
  onResultSelect: (result: PafAddressResult | LocationResult, source: 'paf' | 'aws') => void;
}

interface UseKeyboardNavigationReturn {
  selectedIndex: number;
  focusedSource: 'paf' | 'aws';
}

export function useKeyboardNavigation({
  isDropdownOpen,
  mode,
  pafData,
  awsData,
  debouncedQuery,
  onResultSelect,
}: UseKeyboardNavigationParams): UseKeyboardNavigationReturn {
  const defaultSource = mode === 'location' ? 'aws' as const : 'paf' as const;
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focusedSource, setFocusedSource] = useState<'paf' | 'aws'>(defaultSource);

  // Reset selection when query or mode changes — these are synchronization effects
  // that respond to external prop changes, which is a valid use of useEffect
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedIndex(-1); }, [debouncedQuery, mode]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setFocusedSource(mode === 'location' ? 'aws' : 'paf'); }, [mode]);

  const navigateDown = useCallback(() => {
    const maxIndex = focusedSource === 'paf'
      ? (pafData?.results.length || 0) - 1
      : (awsData?.results.length || 0) - 1;

    if (maxIndex >= 0) {
      setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }
  }, [focusedSource, pafData, awsData]);

  const navigateUp = useCallback(() => {
    const maxIndex = focusedSource === 'paf'
      ? (pafData?.results.length || 0) - 1
      : (awsData?.results.length || 0) - 1;

    if (maxIndex >= 0) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    }
  }, [focusedSource, pafData, awsData]);

  const switchColumn = useCallback(() => {
    // Disable column switching in single-mode
    if (mode) return;

    const hasResults = focusedSource === 'paf'
      ? (awsData?.results.length || 0) > 0
      : (pafData?.results.length || 0) > 0;

    if (hasResults) {
      setFocusedSource((prev) => (prev === 'paf' ? 'aws' : 'paf'));
      setSelectedIndex(0);
    }
  }, [mode, focusedSource, awsData, pafData]);

  const selectCurrentResult = useCallback(() => {
    if (selectedIndex < 0) return;

    const result = focusedSource === 'paf'
      ? pafData?.results[selectedIndex]
      : awsData?.results[selectedIndex];

    if (result) {
      onResultSelect(result, focusedSource);
    }
  }, [selectedIndex, focusedSource, pafData, awsData, onResultSelect]);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          navigateDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigateUp();
          break;
        case 'Tab':
          e.preventDefault();
          switchColumn();
          break;
        case 'Enter':
          e.preventDefault();
          selectCurrentResult();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, navigateDown, navigateUp, switchColumn, selectCurrentResult]);

  return { selectedIndex, focusedSource };
}
