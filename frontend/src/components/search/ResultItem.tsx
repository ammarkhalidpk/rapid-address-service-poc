import { Badge } from '@/components/ui/badge';
import type { PafAddressResult, LocationResult } from '@/types';

interface PafResultItemProps {
  result: PafAddressResult;
}

export function PafResultItem({ result }: PafResultItemProps) {
  return (
    <div className="p-3 hover:bg-accent rounded-md cursor-pointer transition-colors border-b last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{result.address}</p>
          <p className="text-xs text-muted-foreground">
            {result.suburb}, {result.state} {result.postcode}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          PAF
        </Badge>
      </div>
    </div>
  );
}

interface AwsResultItemProps {
  result: LocationResult;
}

export function AwsResultItem({ result }: AwsResultItemProps) {
  return (
    <div className="p-3 hover:bg-accent rounded-md cursor-pointer transition-colors border-b last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{result.text}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          AWS
        </Badge>
      </div>
    </div>
  );
}
