import { useQuery } from '@tanstack/react-query';
import { searchPaf, suggestLocation } from '@/services/address.service';
import type { PafSearchResponse, LocationSuggestResponse } from '@/types';
import type { SearchMode } from '@/types/search.types';

interface UseAddressSearchParams {
  query: string;
  limit?: number;
  mode: SearchMode;
}

interface UseAddressSearchReturn {
  pafData: PafSearchResponse | undefined;
  awsData: LocationSuggestResponse | undefined;
  isPafLoading: boolean;
  isAwsLoading: boolean;
  pafError: Error | null;
  awsError: Error | null;
  isAnyLoading: boolean;
}

/**
 * Custom hook for conditional PAF and AWS address search
 * Queries only the selected mode's endpoint when query length >= 3
 *
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 10)
 * @param mode - Search mode ('paf' or 'location')
 */
export function useAddressSearch({ query, limit = 10, mode }: UseAddressSearchParams): UseAddressSearchReturn {
  const baseEnabled = query.length >= 3;
  const pafEnabled = baseEnabled && (mode === 'paf' || mode === 'both');
  const awsEnabled = baseEnabled && (mode === 'location' || mode === 'both');

  const {
    data: pafData,
    isLoading: isPafLoading,
    error: pafError,
  } = useQuery({
    queryKey: ['paf-search', query, limit],
    queryFn: () => searchPaf({ query, limit }),
    enabled: pafEnabled,
    staleTime: 30000, // 30 seconds
  });

  const {
    data: awsData,
    isLoading: isAwsLoading,
    error: awsError,
  } = useQuery({
    queryKey: ['aws-location', query, limit],
    queryFn: () => suggestLocation({ query, limit }),
    enabled: awsEnabled,
    staleTime: 30000, // 30 seconds
  });

  return {
    pafData,
    awsData,
    isPafLoading,
    isAwsLoading,
    pafError: pafError as Error | null,
    awsError: awsError as Error | null,
    isAnyLoading: isPafLoading || isAwsLoading,
  };
}
