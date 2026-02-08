import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SearchInput } from '@/components/search/SearchInput';
import { ResultsDropdown } from '@/components/search/ResultsDropdown';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { ModeToggle } from '@/components/mode-toggle/ModeToggle';
import { useDebounce } from '@/hooks/useDebounce';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import { useSearchMode } from '@/hooks/useSearchMode';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import type { AnalyticsEntry } from '@/types/analytics.types';
import type { PafAddressResult, LocationResult } from '@/types';

export function AddressSearchPage() {
  const { mode } = useSearchMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEntry[]>([]);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const { pafData, awsData, isPafLoading, isAwsLoading, pafError, awsError, isAnyLoading } = useAddressSearch({
    query: debouncedQuery,
    limit: 10,
    mode,
  });

  // Derive dropdown open state from query length
  const isDropdownOpen = useMemo(() => debouncedQuery.length >= 3, [debouncedQuery]);

  const handleResultSelect = useCallback((result: PafAddressResult | LocationResult, source: 'paf' | 'aws') => {
    console.log('Selected result:', result, 'from', source);
    // TODO: Future enhancement - populate form fields with selected address
  }, []);

  // Use extracted keyboard navigation hook
  const { selectedIndex, focusedSource } = useKeyboardNavigation({
    isDropdownOpen,
    mode,
    pafData,
    awsData,
    debouncedQuery,
    onResultSelect: handleResultSelect,
  });

  // Track analytics - ref to deduplicate entries
  const lastTrackedQueryRef = useRef<string>('');

  // Capture analytics when data arrives for the active mode.
  // This is a synchronization effect responding to external data (API responses).
  useEffect(() => {
    if (debouncedQuery.length < 3) return;

    const trackingKey = `${mode}-${debouncedQuery}`;
    if (lastTrackedQueryRef.current === trackingKey) return;

    if (mode === 'paf' && pafData) {
      lastTrackedQueryRef.current = trackingKey;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnalyticsData((prev) => [...prev, {
        timestamp: Date.now(),
        query: debouncedQuery,
        pafLatency: pafData.latencyMs,
        awsLatency: 0,
        pafResultCount: pafData.count,
        awsResultCount: 0,
        awsCost: 0,
      }]);
    }

    if (mode === 'location' && awsData) {
      lastTrackedQueryRef.current = trackingKey;
      setAnalyticsData((prev) => [...prev, {
        timestamp: Date.now(),
        query: debouncedQuery,
        pafLatency: 0,
        awsLatency: awsData.latencyMs,
        pafResultCount: 0,
        awsResultCount: awsData.count,
        awsCost: awsData.estimatedCost,
      }]);
    }
  }, [mode, pafData, awsData, debouncedQuery]);

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
              onClose={() => setSearchQuery('')}
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
