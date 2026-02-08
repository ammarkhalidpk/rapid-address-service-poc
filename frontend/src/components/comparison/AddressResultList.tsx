import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        {results.map((result) => (
          <div
            key={result.id}
            className="p-4 border rounded-lg hover:bg-accent transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-medium text-sm">{result.address}</p>
              <Badge variant="secondary" className="shrink-0">
                {result.score.toFixed(2)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{result.suburb}</span>
              <span>•</span>
              <span>{result.state}</span>
              <span>•</span>
              <span>{result.postcode}</span>
            </div>
          </div>
        ))}
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
        {results.map((result) => (
          <div
            key={result.placeId}
            className="p-4 border rounded-lg hover:bg-accent transition-colors"
          >
            <p className="font-medium text-sm mb-1">{result.text}</p>
            <p className="text-xs text-muted-foreground font-mono">{result.placeId}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
