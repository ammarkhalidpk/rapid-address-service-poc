// PAF API Types
export interface PafAddressResult {
  id: string;
  address: string;
  addressShort: string;
  suburb: string;
  postcode: string;
  state: string;
  street: string;
  streetNumber: string;
  unit: string;
  buildingName: string;
  score: number;
}

export interface PafSearchResponse {
  query: string;
  results: PafAddressResult[];
  count: number;
  total: number;
  source: 'PAF';
  latencyMs: number;
}

// AWS Location Service Types
export interface LocationResult {
  text: string;
  placeId: string;
}

export interface LocationSuggestResponse {
  results: LocationResult[];
  count: number;
  latencyMs: number;
  estimatedCost: number;
}

export interface AddressSearchParams {
  query: string;
  limit?: number;
}

export interface LocationSearchParams extends AddressSearchParams {
  biasPosition?: string;
}
