import { useState } from 'react';
import { SEARCH_MODE_STORAGE_KEY, DEFAULT_SEARCH_MODE, type SearchMode } from '@/types/search.types';

interface UseSearchModeReturn {
  mode: SearchMode;
  setMode: (mode: SearchMode) => void;
}

/**
 * Type guard to validate if a value is a valid SearchMode
 */
function isValidMode(value: string): value is SearchMode {
  return value === 'paf' || value === 'location' || value === 'both';
}

/**
 * Custom hook for managing search mode with localStorage persistence
 *
 * @returns Object with current mode and setMode function
 *
 * @example
 * const { mode, setMode } = useSearchMode();
 * setMode('location'); // Switch to Location mode
 */
export function useSearchMode(): UseSearchModeReturn {
  const getInitialMode = (): SearchMode => {
    try {
      const stored = localStorage.getItem(SEARCH_MODE_STORAGE_KEY);
      if (stored && isValidMode(stored)) {
        return stored;
      }
    } catch (error) {
      console.warn('Failed to read search mode from localStorage:', error);
    }
    return DEFAULT_SEARCH_MODE;
  };

  const [mode, setModeState] = useState<SearchMode>(getInitialMode);

  const setMode = (newMode: SearchMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(SEARCH_MODE_STORAGE_KEY, newMode);
    } catch (error) {
      console.warn('Failed to persist search mode to localStorage:', error);
      // Continue working in-memory only
    }
  };

  return { mode, setMode };
}
