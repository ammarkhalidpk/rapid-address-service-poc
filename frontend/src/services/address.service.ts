import apiClient from '@/lib/api-client';
import type {
  AddressSearchParams,
  LocationSearchParams,
  PafSearchResponse,
  LocationSuggestResponse,
} from '@/types';

/**
 * Search PAF (Postal Address File) database for addresses
 * @param params - Search parameters including query and optional limit
 * @returns Promise with PAF search results
 */
export async function searchPaf(params: AddressSearchParams): Promise<PafSearchResponse> {
  const { query, limit = 10 } = params;

  const response = await apiClient.get<PafSearchResponse>('/paf/search', {
    params: {
      q: query,
      limit,
    },
  });

  return response.data;
}

/**
 * Get address suggestions from AWS Location Service
 * @param params - Search parameters including query, optional limit, and biasPosition
 * @returns Promise with location suggestions
 */
export async function suggestLocation(
  params: LocationSearchParams
): Promise<LocationSuggestResponse> {
  const { query, limit = 10, biasPosition } = params;

  const response = await apiClient.get<LocationSuggestResponse>('/location/suggest', {
    params: {
      q: query,
      limit,
      biasPosition,
    },
  });

  return response.data;
}
