import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsEntry } from '@/types/analytics.types';

interface LatencyComparisonChartProps {
  data: AnalyticsEntry[];
}

export function LatencyComparisonChart({ data }: LatencyComparisonChartProps) {
  // Take last 10 searches
  const chartData = data.slice(-10);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Latency Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>No search data available yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxLatency = Math.max(
    ...chartData.flatMap((entry) => [entry.pafLatency, entry.awsLatency])
  );

  const chartHeight = 300;
  const chartWidth = 100;
  const barWidth = chartWidth / (chartData.length * 2 + chartData.length); // Space for 2 bars + gap per entry

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Latency Comparison (Last 10 Searches)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>PAF Database</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span>AWS Location</span>
            </div>
          </div>

          {/* Chart */}
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
              className="w-full h-[300px]"
              preserveAspectRatio="xMidYMid meet"
              style={{ minWidth: `${chartData.length * 80}px` }}
            >
              {/* Y-axis labels */}
              <text x="2" y="15" fontSize="10" fill="currentColor" className="text-muted-foreground">
                {maxLatency}ms
              </text>
              <text x="2" y={chartHeight / 2} fontSize="10" fill="currentColor" className="text-muted-foreground">
                {Math.round(maxLatency / 2)}ms
              </text>
              <text x="2" y={chartHeight - 5} fontSize="10" fill="currentColor" className="text-muted-foreground">
                0ms
              </text>

              {/* Bars */}
              {chartData.map((entry, index) => {
                const x = (index * (barWidth * 3)) + barWidth;
                const pafHeight = (entry.pafLatency / maxLatency) * (chartHeight - 40);
                const awsHeight = (entry.awsLatency / maxLatency) * (chartHeight - 40);
                const pafY = chartHeight - pafHeight;
                const awsY = chartHeight - awsHeight;

                return (
                  <g key={entry.timestamp}>
                    {/* PAF bar */}
                    <rect
                      x={`${x}%`}
                      y={pafY}
                      width={`${barWidth * 0.8}%`}
                      height={pafHeight}
                      fill="rgb(59, 130, 246)"
                      rx="2"
                    />
                    <text
                      x={`${x + barWidth * 0.4}%`}
                      y={pafY - 5}
                      fontSize="9"
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      {entry.pafLatency}
                    </text>

                    {/* AWS bar */}
                    <rect
                      x={`${x + barWidth}%`}
                      y={awsY}
                      width={`${barWidth * 0.8}%`}
                      height={awsHeight}
                      fill="rgb(249, 115, 22)"
                      rx="2"
                    />
                    <text
                      x={`${x + barWidth * 1.4}%`}
                      y={awsY - 5}
                      fontSize="9"
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      {entry.awsLatency}
                    </text>

                    {/* X-axis label (search index) */}
                    <text
                      x={`${x + barWidth}%`}
                      y={chartHeight + 20}
                      fontSize="10"
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      #{index + 1}
                    </text>
                  </g>
                );
              })}

              {/* Baseline */}
              <line
                x1="0"
                y1={chartHeight}
                x2="100%"
                y2={chartHeight}
                stroke="currentColor"
                strokeWidth="1"
                className="text-muted-foreground opacity-30"
              />
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
