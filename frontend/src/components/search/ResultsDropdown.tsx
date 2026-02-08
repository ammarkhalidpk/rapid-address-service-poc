import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PafResultItem, AwsResultItem } from './ResultItem';
import { ErrorAlert } from '@/components/ui/error-alert';
import { getErrorMessage } from '@/lib/error-handling';
import type { PafSearchResponse, LocationSuggestResponse, PafAddressResult, LocationResult } from '@/types';
import type { SearchMode } from '@/types/search.types';

interface ResultsDropdownProps {
  pafData: PafSearchResponse | undefined;
  awsData: LocationSuggestResponse | undefined;
  isPafLoading: boolean;
  isAwsLoading: boolean;
  pafError: Error | null;
  awsError: Error | null;
  isOpen: boolean;
  onClose: () => void;
  selectedIndex: number;
  focusedSource: 'paf' | 'aws';
  onResultSelect: (result: PafAddressResult | LocationResult, source: 'paf' | 'aws') => void;
  mode?: SearchMode;
}

export function ResultsDropdown({
  pafData,
  awsData,
  isPafLoading,
  isAwsLoading,
  pafError,
  awsError,
  isOpen,
  onClose,
  selectedIndex,
  focusedSource,
  onResultSelect,
  mode,
}: ResultsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

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

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex, focusedSource]);

  if (!isOpen) return null;

  const hasPafResults = pafData && pafData.results.length > 0;
  const hasAwsResults = awsData && awsData.results.length > 0;
  const showPafError = pafError && !isPafLoading;
  const showAwsError = awsError && !isAwsLoading;

  // Determine if single-column layout should be used
  const isSingleColumn = mode !== undefined;
  const showPaf = !mode || mode === 'paf';
  const showAws = !mode || mode === 'location';

  return (
    <Card
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[500px] overflow-hidden shadow-lg"
      role="listbox"
      id="address-search-results"
    >
      {/* Desktop: Single or Two-column layout */}
      <div className={`hidden md:grid ${isSingleColumn ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
        {/* PAF Column */}
        {showPaf && (
        <div className={isSingleColumn ? '' : 'border-r'}>
          <div className="p-3 bg-muted/50 border-b">
            <h3 className="font-semibold text-sm">
              PAF Results
              {hasPafResults && ` (${pafData.results.length})`}
            </h3>
          </div>
          <ScrollArea className="h-[400px]">
            {showPafError && <ErrorAlert message={getErrorMessage(pafError)} />}
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
                {pafData.results.map((result, index) => {
                  const isSelected = focusedSource === 'paf' && selectedIndex === index;
                  return (
                    <div key={result.id} ref={isSelected ? selectedItemRef : undefined}>
                      <PafResultItem
                        result={result}
                        isSelected={isSelected}
                        onClick={() => onResultSelect(result, 'paf')}
                      />
                    </div>
                  );
                })}
              </div>
            ) : !showPafError ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            ) : null}
          </ScrollArea>
        </div>
        )}

        {/* AWS Column */}
        {showAws && (
        <div>
          <div className="p-3 bg-muted/50 border-b">
            <h3 className="font-semibold text-sm">
              AWS Location Results
              {hasAwsResults && ` (${awsData.results.length})`}
            </h3>
          </div>
          <ScrollArea className="h-[400px]">
            {showAwsError && <ErrorAlert message={getErrorMessage(awsError)} />}
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
                {awsData.results.map((result, index) => {
                  const isSelected = focusedSource === 'aws' && selectedIndex === index;
                  return (
                    <div key={result.placeId} ref={isSelected ? selectedItemRef : undefined}>
                      <AwsResultItem
                        result={result}
                        isSelected={isSelected}
                        onClick={() => onResultSelect(result, 'aws')}
                      />
                    </div>
                  );
                })}
              </div>
            ) : !showAwsError ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            ) : null}
          </ScrollArea>
        </div>
        )}
      </div>

      {/* Mobile: Tabbed layout (only show tabs if not in single-mode) */}
      {isSingleColumn ? (
        <div className="md:hidden">
          {mode === 'paf' && (
            <ScrollArea className="h-[400px]">
              {showPafError && <ErrorAlert message={getErrorMessage(pafError)} />}
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
                  {pafData.results.map((result, index) => {
                    const isSelected = focusedSource === 'paf' && selectedIndex === index;
                    return (
                      <div key={result.id} ref={isSelected ? selectedItemRef : undefined}>
                        <PafResultItem
                          result={result}
                          isSelected={isSelected}
                          onClick={() => onResultSelect(result, 'paf')}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : !showPafError ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
              ) : null}
            </ScrollArea>
          )}
          {mode === 'location' && (
            <ScrollArea className="h-[400px]">
              {showAwsError && <ErrorAlert message={getErrorMessage(awsError)} />}
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
                  {awsData.results.map((result, index) => {
                    const isSelected = focusedSource === 'aws' && selectedIndex === index;
                    return (
                      <div key={result.placeId} ref={isSelected ? selectedItemRef : undefined}>
                        <AwsResultItem
                          result={result}
                          isSelected={isSelected}
                          onClick={() => onResultSelect(result, 'aws')}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : !showAwsError ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
              ) : null}
            </ScrollArea>
          )}
        </div>
      ) : (
      <Tabs defaultValue="paf" className="md:hidden">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="paf" className="flex-1">
            PAF Results {hasPafResults && `(${pafData.results.length})`}
          </TabsTrigger>
          <TabsTrigger value="aws" className="flex-1">
            AWS Results {hasAwsResults && `(${awsData.results.length})`}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="paf" className="mt-0">
          <ScrollArea className="h-[400px]">
            {showPafError && <ErrorAlert message={getErrorMessage(pafError)} />}
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
                {pafData.results.map((result, index) => {
                  const isSelected = focusedSource === 'paf' && selectedIndex === index;
                  return (
                    <div key={result.id} ref={isSelected ? selectedItemRef : undefined}>
                      <PafResultItem
                        result={result}
                        isSelected={isSelected}
                        onClick={() => onResultSelect(result, 'paf')}
                      />
                    </div>
                  );
                })}
              </div>
            ) : !showPafError ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            ) : null}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="aws" className="mt-0">
          <ScrollArea className="h-[400px]">
            {showAwsError && <ErrorAlert message={getErrorMessage(awsError)} />}
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
                {awsData.results.map((result, index) => {
                  const isSelected = focusedSource === 'aws' && selectedIndex === index;
                  return (
                    <div key={result.placeId} ref={isSelected ? selectedItemRef : undefined}>
                      <AwsResultItem
                        result={result}
                        isSelected={isSelected}
                        onClick={() => onResultSelect(result, 'aws')}
                      />
                    </div>
                  );
                })}
              </div>
            ) : !showAwsError ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found</div>
            ) : null}
          </ScrollArea>
        </TabsContent>
      </Tabs>
      )}
    </Card>
  );
}
