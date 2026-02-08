import { MetricCard } from '@/components/analytics/MetricCard';
import { calculateComparisonMetrics } from '@/lib/comparison-utils';
import type { PafSearchResponse, LocationSuggestResponse } from '@/types';

interface ComparisonMetricsProps {
  pafData: PafSearchResponse | undefined;
  awsData: LocationSuggestResponse | undefined;
}

/**
 * ComparisonMetrics displays aggregate comparison metrics for PAF vs AWS Location Service.
 * Shows response times, completeness percentages, and result counts.
 * Only renders when both pafData and awsData are available.
 */
export function ComparisonMetrics({ pafData, awsData }: ComparisonMetricsProps) {
  const metrics = calculateComparisonMetrics(pafData, awsData);

  // Only render when both datasets are available
  if (!metrics) {
    return null;
  }

  // Calculate field counts for completeness context
  const pafFieldCount = 10; // PAF has 10 fields
  const awsFieldCount = 2;  // AWS has 2 fields

  const pafAvgFieldsComplete = (metrics.pafCompletenessAvg / 100) * pafFieldCount;
  const awsAvgFieldsComplete = (metrics.awsCompletenessAvg / 100) * awsFieldCount;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comparison Metrics</h3>

      {/* Responsive grid: 4 cols desktop, 2 cols tablet, 1 col mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Response Time Metrics */}
        <MetricCard
          title="PAF Response Time"
          value={`${metrics.pafLatency}ms`}
          subtitle="PAF Database latency"
        />

        <MetricCard
          title="AWS Response Time"
          value={`${metrics.awsLatency}ms`}
          subtitle="AWS Location Service latency"
        />

        <MetricCard
          title="Response Time Difference"
          value={`${metrics.latencyDifference}ms`}
          subtitle={`${metrics.fasterService.toUpperCase()} is faster`}
        />

        {/* Completeness Metrics */}
        <MetricCard
          title="PAF Completeness"
          value={`${metrics.pafCompletenessAvg.toFixed(0)}%`}
          subtitle={`${pafAvgFieldsComplete.toFixed(1)}/${pafFieldCount} fields avg`}
        />

        <MetricCard
          title="AWS Completeness"
          value={`${metrics.awsCompletenessAvg.toFixed(0)}%`}
          subtitle={`${awsAvgFieldsComplete.toFixed(1)}/${awsFieldCount} fields avg`}
        />

        <MetricCard
          title="Completeness Winner"
          value={metrics.moreCompleteService.toUpperCase()}
          subtitle={`+${metrics.completenessDifference.toFixed(0)}% more complete`}
        />

        {/* Result Count Metrics */}
        <MetricCard
          title="PAF Results"
          value={metrics.pafResultCount}
          subtitle="Addresses found"
        />

        <MetricCard
          title="AWS Results"
          value={metrics.awsResultCount}
          subtitle="Addresses found"
        />
      </div>
    </div>
  );
}
