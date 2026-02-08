import { Activity, Clock, DollarSign, Search } from 'lucide-react';
import { MetricCard } from './MetricCard';
import { LatencyComparisonChart } from './LatencyComparisonChart';
import type { AnalyticsEntry } from '@/types/analytics.types';

interface AnalyticsDashboardProps {
  data: AnalyticsEntry[];
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const totalSearches = data.length;
  const avgPafLatency =
    totalSearches > 0
      ? Math.round(data.reduce((sum, entry) => sum + entry.pafLatency, 0) / totalSearches)
      : 0;
  const avgAwsLatency =
    totalSearches > 0
      ? Math.round(data.reduce((sum, entry) => sum + entry.awsLatency, 0) / totalSearches)
      : 0;
  const totalCost = data.reduce((sum, entry) => sum + entry.awsCost, 0);

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Searches"
          value={totalSearches}
          subtitle="Queries performed"
          icon={Search}
        />
        <MetricCard
          title="Avg PAF Latency"
          value={`${avgPafLatency}ms`}
          subtitle="Database response time"
          icon={Activity}
        />
        <MetricCard
          title="Avg AWS Latency"
          value={`${avgAwsLatency}ms`}
          subtitle="Location API response time"
          icon={Clock}
        />
        <MetricCard
          title="Total AWS Cost"
          value={`$${totalCost.toFixed(4)}`}
          subtitle="Estimated AWS charges"
          icon={DollarSign}
        />
      </div>

      {/* Latency Chart */}
      <LatencyComparisonChart data={data} />
    </div>
  );
}
