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

  const barHeight = 14;
  const rowGap = 8;
  const rowHeight = barHeight * 2 + rowGap;
  const chartLeft = 45;
  const chartRight = 45;
  const totalWidth = 500;
  const barAreaWidth = totalWidth - chartLeft - chartRight;

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

          {/* Horizontal Bar Chart */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${totalWidth} ${chartData.length * (rowHeight + 12) + 30}`}
              className="w-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* X-axis labels */}
              <text x={chartLeft} y={12} fontSize="9" fill="currentColor" className="text-muted-foreground">
                0ms
              </text>
              <text x={chartLeft + barAreaWidth / 2} y={12} fontSize="9" textAnchor="middle" fill="currentColor" className="text-muted-foreground">
                {Math.round(maxLatency / 2)}ms
              </text>
              <text x={chartLeft + barAreaWidth} y={12} fontSize="9" textAnchor="end" fill="currentColor" className="text-muted-foreground">
                {maxLatency}ms
              </text>

              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line
                  key={pct}
                  x1={chartLeft + barAreaWidth * pct}
                  y1={18}
                  x2={chartLeft + barAreaWidth * pct}
                  y2={chartData.length * (rowHeight + 12) + 20}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-muted-foreground opacity-20"
                />
              ))}

              {/* Bars */}
              {chartData.map((entry, index) => {
                const y = index * (rowHeight + 12) + 24;
                const pafWidth = (entry.pafLatency / maxLatency) * barAreaWidth;
                const awsWidth = (entry.awsLatency / maxLatency) * barAreaWidth;

                return (
                  <g key={entry.timestamp}>
                    {/* Row label */}
                    <text
                      x={chartLeft - 6}
                      y={y + rowHeight / 2 + 2}
                      fontSize="10"
                      textAnchor="end"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      #{index + 1}
                    </text>

                    {/* PAF bar */}
                    <rect
                      x={chartLeft}
                      y={y}
                      width={Math.max(pafWidth, 2)}
                      height={barHeight}
                      fill="rgb(59, 130, 246)"
                      rx="2"
                    />
                    <text
                      x={chartLeft + pafWidth + 4}
                      y={y + barHeight - 3}
                      fontSize="9"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      {entry.pafLatency}ms
                    </text>

                    {/* AWS bar */}
                    <rect
                      x={chartLeft}
                      y={y + barHeight + 2}
                      width={Math.max(awsWidth, 2)}
                      height={barHeight}
                      fill="rgb(249, 115, 22)"
                      rx="2"
                    />
                    <text
                      x={chartLeft + awsWidth + 4}
                      y={y + barHeight * 2}
                      fontSize="9"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      {entry.awsLatency}ms
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
