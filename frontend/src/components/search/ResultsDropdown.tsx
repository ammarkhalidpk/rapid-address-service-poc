import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PafResultItem, AwsResultItem } from './ResultItem';
import type { PafSearchResponse, LocationSuggestResponse } from '@/types';

interface ResultsDropdownProps {
  pafData: PafSearchResponse | undefined;
  awsData: LocationSuggestResponse | undefined;
  isPafLoading: boolean;
  isAwsLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function ResultsDropdown({
  pafData,
  awsData,
  isPafLoading,
  isAwsLoading,
  isOpen,
  onClose,
}: ResultsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasPafResults = pafData && pafData.results.length > 0;
  const hasAwsResults = awsData && awsData.results.length > 0;

  return (
    <Card
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[500px] overflow-hidden shadow-lg"
    >
      {/* Desktop: Two-column layout */}
      <div className="hidden md:grid md:grid-cols-2">
        {/* PAF Column */}
        <div className="border-r">
          <div className="p-3 bg-muted/50 border-b">
            <h3 className="font-semibold text-sm">PAF Results</h3>
          </div>
          <ScrollArea className="h-[400px]">
            {isPafLoading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : hasPafResults ? (
              <div>
                {pafData.results.map((result) => (
                  <PafResultItem key={result.id} result={result} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            )}
          </ScrollArea>
        </div>

        {/* AWS Column */}
        <div>
          <div className="p-3 bg-muted/50 border-b">
            <h3 className="font-semibold text-sm">AWS Location Results</h3>
          </div>
          <ScrollArea className="h-[400px]">
            {isAwsLoading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : hasAwsResults ? (
              <div>
                {awsData.results.map((result) => (
                  <AwsResultItem key={result.placeId} result={result} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Mobile: Tabbed layout */}
      <Tabs defaultValue="paf" className="md:hidden">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="paf" className="flex-1">
            PAF Results
          </TabsTrigger>
          <TabsTrigger value="aws" className="flex-1">
            AWS Results
          </TabsTrigger>
        </TabsList>
        <TabsContent value="paf" className="mt-0">
          <ScrollArea className="h-[400px]">
            {isPafLoading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : hasPafResults ? (
              <div>
                {pafData.results.map((result) => (
                  <PafResultItem key={result.id} result={result} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="aws" className="mt-0">
          <ScrollArea className="h-[400px]">
            {isAwsLoading ? (
              <div className="p-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : hasAwsResults ? (
              <div>
                {awsData.results.map((result) => (
                  <AwsResultItem key={result.placeId} result={result} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
