import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { calculatePafCompleteness, calculateAwsCompleteness, getCompletenessBadgeVariant } from '@/lib/comparison-utils';
import type { PafAddressResult, LocationResult } from '@/types';

interface PafResultListProps {
  results: PafAddressResult[];
}

export function PafResultList({ results }: PafResultListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No PAF results found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {results.map((result) => {
          const completeness = calculatePafCompleteness(result);
          const completenessVariant = getCompletenessBadgeVariant(completeness);

          return (
            <div
              key={result.id}
              className="p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium text-sm">{result.address}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary">
                    {result.score.toFixed(2)}
                  </Badge>
                  <Badge variant={completenessVariant}>
                    {completeness.toFixed(0)}%
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{result.suburb}</span>
                <span>•</span>
                <span>{result.state}</span>
                <span>•</span>
                <span>{result.postcode}</span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

interface AwsResultListProps {
  results: LocationResult[];
}

export function AwsResultList({ results }: AwsResultListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No AWS results found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {results.map((result) => {
          const completeness = calculateAwsCompleteness(result);
          const completenessVariant = getCompletenessBadgeVariant(completeness);

          return (
            <div
              key={result.placeId}
              className="p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-sm">{result.text}</p>
                <Badge variant={completenessVariant} className="shrink-0">
                  {completeness.toFixed(0)}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{result.placeId}</p>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
