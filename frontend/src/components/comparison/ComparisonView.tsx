import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PafResultList, AwsResultList } from './AddressResultList';
import { ComparisonMetrics } from './ComparisonMetrics';
import type { PafSearchResponse, LocationSuggestResponse } from '@/types';

interface ComparisonViewProps {
  pafData: PafSearchResponse | undefined;
  awsData: LocationSuggestResponse | undefined;
}

export function ComparisonView({ pafData, awsData }: ComparisonViewProps) {
  if (!pafData && !awsData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Only show comparison metrics when both datasets are available */}
      {pafData && awsData && (
        <ComparisonMetrics pafData={pafData} awsData={awsData} />
      )}

      {/* Two-column result display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PAF Results Card */}
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">PAF Database</CardTitle>
            <div className="flex items-center gap-2">
              {pafData && (
                <>
                  <Badge variant="outline">{pafData.count} results</Badge>
                  <Badge variant="secondary">{pafData.latencyMs}ms</Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pafData ? (
            <PafResultList results={pafData.results} />
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>No search performed yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AWS Results Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">AWS Location Service</CardTitle>
            <div className="flex items-center gap-2">
              {awsData && (
                <>
                  <Badge variant="outline">{awsData.count} results</Badge>
                  <Badge variant="secondary">{awsData.latencyMs}ms</Badge>
                  <Badge variant="default">${awsData.estimatedCost.toFixed(4)}</Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {awsData ? (
            <AwsResultList results={awsData.results} />
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>No search performed yet</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
