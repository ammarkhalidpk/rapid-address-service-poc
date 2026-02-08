import { useQuery } from '@tanstack/react-query';
import { searchPaf, suggestLocation } from '@/services/address.service';
import type { PafSearchResponse, LocationSuggestResponse } from '@/types';

interface UseAddressSearchParams {
  query: string;
  limit?: number;
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
 * Custom hook for parallel PAF and AWS address search
 * Enables queries when query length >= 3
 */
export function useAddressSearch({ query, limit = 10 }: UseAddressSearchParams): UseAddressSearchReturn {
  const enabled = query.length >= 3;

  const {
    data: pafData,
    isLoading: isPafLoading,
    error: pafError,
  } = useQuery({
    queryKey: ['paf-search', query, limit],
    queryFn: () => searchPaf({ query, limit }),
    enabled,
    staleTime: 30000, // 30 seconds
  });

  const {
    data: awsData,
    isLoading: isAwsLoading,
    error: awsError,
  } = useQuery({
    queryKey: ['aws-location', query, limit],
    queryFn: () => suggestLocation({ query, limit }),
    enabled,
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
