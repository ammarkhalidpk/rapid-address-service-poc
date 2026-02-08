import { useState, useEffect } from 'react';
import { SearchInput } from '@/components/search/SearchInput';
import { ResultsDropdown } from '@/components/search/ResultsDropdown';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { useDebounce } from '@/hooks/useDebounce';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import type { AnalyticsEntry } from '@/types/analytics.types';

export function AddressSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsEntry[]>([]);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const { pafData, awsData, isPafLoading, isAwsLoading, isAnyLoading } = useAddressSearch({
    query: debouncedQuery,
    limit: 10,
  });

  // Open dropdown when there's a query
  useEffect(() => {
    if (debouncedQuery.length >= 3) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  }, [debouncedQuery]);

  // Capture analytics when both queries complete successfully
  useEffect(() => {
    if (pafData && awsData && debouncedQuery.length >= 3) {
      const entry: AnalyticsEntry = {
        timestamp: Date.now(),
        query: debouncedQuery,
        pafLatency: pafData.latencyMs,
        awsLatency: awsData.latencyMs,
        pafResultCount: pafData.count,
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
  }, [pafData, awsData, debouncedQuery]);

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

        {/* Search Section */}
        <div className="mb-8 max-w-3xl mx-auto">
          <div className="relative">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              isLoading={isAnyLoading}
              placeholder="Search Australian addresses..."
            />
            <ResultsDropdown
              pafData={pafData}
              awsData={awsData}
              isPafLoading={isPafLoading}
              isAwsLoading={isAwsLoading}
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
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
