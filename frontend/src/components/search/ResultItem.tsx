import { Badge } from '@/components/ui/badge';
import type { PafAddressResult, LocationResult } from '@/types';
import { cn } from '@/lib/utils';

interface PafResultItemProps {
  result: PafAddressResult;
  isSelected?: boolean;
  onClick?: () => void;
}

export function PafResultItem({ result, isSelected = false, onClick }: PafResultItemProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-md cursor-pointer transition-colors border-b last:border-b-0',
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent'
      )}
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{result.address}</p>
          <p className={cn('text-xs', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {result.suburb}, {result.state} {result.postcode}
          </p>
        </div>
        <Badge variant={isSelected ? 'outline' : 'secondary'} className="shrink-0">
          PAF
        </Badge>
      </div>
    </div>
  );
}

interface AwsResultItemProps {
  result: LocationResult;
  isSelected?: boolean;
  onClick?: () => void;
}

export function AwsResultItem({ result, isSelected = false, onClick }: AwsResultItemProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-md cursor-pointer transition-colors border-b last:border-b-0',
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent'
      )}
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
    >
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
