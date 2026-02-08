import { Database, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchMode } from '@/hooks/useSearchMode';
import { cn } from '@/lib/utils';

interface ModeToggleProps {
  className?: string;
}

/**
 * Mode toggle component for switching between PAF and Location search modes
 *
 * Provides a button group UI with visual indicators for the active mode.
 * Selection is persisted to localStorage via the useSearchMode hook.
 *
 * @param className - Optional Tailwind classes for positioning
 *
 * @example
 * <ModeToggle className="mb-6" />
 */
export function ModeToggle({ className }: ModeToggleProps) {
  const { mode, setMode } = useSearchMode();

  return (
    <div
      role="radiogroup"
      aria-label="Select search data source"
      className={cn('flex gap-2', className)}
    >
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
