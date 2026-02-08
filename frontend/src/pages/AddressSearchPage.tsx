import { useState, useEffect } from 'react';
import { SearchInput } from '@/components/search/SearchInput';
import { ResultsDropdown } from '@/components/search/ResultsDropdown';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { ModeToggle } from '@/components/mode-toggle/ModeToggle';
import { useDebounce } from '@/hooks/useDebounce';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import { useSearchMode } from '@/hooks/useSearchMode';
import type { AnalyticsEntry } from '@/types/analytics.types';
import type { PafAddressResult, LocationResult } from '@/types';

export function AddressSearchPage() {
  const { mode } = useSearchMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focusedSource, setFocusedSource] = useState<'paf' | 'aws'>('paf');

  const debouncedQuery = useDebounce(searchQuery, 300);

  const { pafData, awsData, isPafLoading, isAwsLoading, pafError, awsError, isAnyLoading } = useAddressSearch({
    query: debouncedQuery,
    limit: 10,
    mode,
  });

  // Open dropdown when there's a query
  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
    }
  }, [debouncedQuery]);

  // Reset selection when query changes or mode changes
  useEffect(() => {
    setSelectedIndex(-1);
    setFocusedSource(mode === 'location' ? 'aws' : 'paf');
  }, [debouncedQuery, mode]);

  // Capture analytics based on active mode
  useEffect(() => {
    if (debouncedQuery.length < 3) return;

    if (mode === 'paf' && pafData) {
      const entry: AnalyticsEntry = {
        timestamp: Date.now(),
        query: debouncedQuery,
        pafLatency: pafData.latencyMs,
        awsLatency: 0,
        pafResultCount: pafData.count,
        awsResultCount: 0,
        awsCost: 0,
      };

      setAnalyticsData((prev) => {
        // Avoid duplicate entries for the same query/timestamp
        const lastEntry = prev[prev.length - 1];
        if (lastEntry && lastEntry.query === entry.query && lastEntry.timestamp === entry.timestamp) {
          return prev;
        }
        return [...prev, entry];
      });
    }

    if (mode === 'location' && awsData) {
      const entry: AnalyticsEntry = {
        timestamp: Date.now(),
        query: debouncedQuery,
        pafLatency: 0,
        awsLatency: awsData.latencyMs,
        pafResultCount: 0,
        awsResultCount: awsData.count,
        awsCost: awsData.estimatedCost,
      };

      setAnalyticsData((prev) => {
        // Avoid duplicate entries for the same query/timestamp
        const lastEntry = prev[prev.length - 1];
        if (lastEntry && lastEntry.query === entry.query && lastEntry.timestamp === entry.timestamp) {
          return prev;
        }
        return [...prev, entry];
      });
    }
  }, [mode, pafData, awsData, debouncedQuery]);

  // Keyboard navigation handlers
  const navigateDown = () => {
    const maxIndex = focusedSource === 'paf'
      ? (pafData?.results.length || 0) - 1
      : (awsData?.results.length || 0) - 1;

    if (maxIndex >= 0) {
      setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }
  };

  const navigateUp = () => {
    const maxIndex = focusedSource === 'paf'
      ? (pafData?.results.length || 0) - 1
      : (awsData?.results.length || 0) - 1;

    if (maxIndex >= 0) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    }
  };

  const switchColumn = () => {
    // Disable column switching in single-mode
    if (mode) return;

    const hasResults = focusedSource === 'paf'
      ? (awsData?.results.length || 0) > 0
      : (pafData?.results.length || 0) > 0;

    if (hasResults) {
      setFocusedSource((prev) => (prev === 'paf' ? 'aws' : 'paf'));
      setSelectedIndex(0);
    }
  };

  const selectCurrentResult = () => {
    if (selectedIndex < 0) return;

    const result = focusedSource === 'paf'
      ? pafData?.results[selectedIndex]
      : awsData?.results[selectedIndex];

    if (result) {
      handleResultSelect(result, focusedSource);
    }
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
  };

  const handleResultSelect = (result: PafAddressResult | LocationResult, source: 'paf' | 'aws') => {
    console.log('Selected result:', result, 'from', source);
    // TODO: Future enhancement - populate form fields with selected address
    closeDropdown();
  };

  // Keyboard event listener
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
        case 'Escape':
          e.preventDefault();
          closeDropdown();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, selectedIndex, focusedSource, pafData, awsData]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Rapid Address Service</h1>
          <p className="text-lg text-muted-foreground">
            Compare PAF Database and AWS Location Service performance
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="mb-6 flex justify-center">
          <ModeToggle />
        </div>

        {/* Search Section */}
        <div className="mb-8 max-w-3xl mx-auto">
          <div className="relative">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              isLoading={isAnyLoading}
              placeholder="Search Australian addresses..."
              isDropdownOpen={isDropdownOpen}
            />
            <ResultsDropdown
              pafData={pafData}
              awsData={awsData}
              isPafLoading={isPafLoading}
              isAwsLoading={isAwsLoading}
              pafError={pafError}
              awsError={awsError}
              isOpen={isDropdownOpen}
              onClose={closeDropdown}
              selectedIndex={selectedIndex}
              focusedSource={focusedSource}
              onResultSelect={handleResultSelect}
              mode={mode}
            />
          </div>
          {debouncedQuery.length > 0 && debouncedQuery.length < 3 && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Type at least 3 characters to search
            </p>
          )}
        </div>

        {/* Comparison View */}
        {(pafData || awsData) && (
          <div className="mb-8">
            <ComparisonView pafData={pafData} awsData={awsData} />
          </div>
        )}

        {/* Analytics Dashboard */}
        {analyticsData.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Analytics</h2>
            <AnalyticsDashboard data={analyticsData} />
          </div>
        )}
      </div>
    </div>
  );
}
