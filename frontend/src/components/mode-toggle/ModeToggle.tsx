import { Database, MapPin, Columns2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchMode } from '@/hooks/useSearchMode';
import { cn } from '@/lib/utils';

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { mode, setMode } = useSearchMode();

  return (
    <div
      role="radiogroup"
      aria-label="Select search data source"
      className={cn('flex gap-2', className)}
    >
      <Button
        variant={mode === 'both' ? 'default' : 'outline'}
        onClick={() => setMode('both')}
        role="radio"
        aria-checked={mode === 'both'}
        className="transition-all duration-200"
      >
        <Columns2 className="h-4 w-4" />
        Both
      </Button>
      <Button
        variant={mode === 'paf' ? 'default' : 'outline'}
        onClick={() => setMode('paf')}
        role="radio"
        aria-checked={mode === 'paf'}
        className="transition-all duration-200"
      >
        <Database className="h-4 w-4" />
        PAF Database
      </Button>
      <Button
        variant={mode === 'location' ? 'default' : 'outline'}
        onClick={() => setMode('location')}
        role="radio"
        aria-checked={mode === 'location'}
        className="transition-all duration-200"
      >
        <MapPin className="h-4 w-4" />
        AWS Location
      </Button>
    </div>
  );
}
