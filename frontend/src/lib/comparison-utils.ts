import type { PafAddressResult, LocationResult, PafSearchResponse, LocationSuggestResponse } from '@/types';

/**
 * Comparison metrics for PAF vs AWS Location Service
 */
export interface ComparisonMetrics {
  // Response time comparison
  pafLatency: number;
  awsLatency: number;
  latencyDifference: number;
  fasterService: 'paf' | 'aws';

  // Completeness comparison
  pafCompletenessAvg: number;      // 0-100%
  awsCompletenessAvg: number;      // 0-100%
  completenessDifference: number;  // Percentage point difference
  moreCompleteService: 'paf' | 'aws';

  // Result count
  pafResultCount: number;
  awsResultCount: number;

  // Cost (AWS only)
  awsCost: number;
}

/**
 * Calculate completeness percentage for PAF address result.
 * Checks 10 fields: address, suburb, postcode, state, street, streetNumber,
 * unit, buildingName, addressShort, id.
 *
 * @param result - PAF address result to evaluate
 * @returns Completeness percentage (0-100)
 */
export function calculatePafCompleteness(result: PafAddressResult): number {
  const fields = [
    result.address,
    result.suburb,
    result.postcode,
    result.state,
    result.street,
    result.streetNumber,
    result.unit,
    result.buildingName,
    result.addressShort,
    result.id,
  ];

  const nonEmptyCount = fields.filter(f => f && f.trim() !== '').length;
  return (nonEmptyCount / fields.length) * 100;
}

/**
 * Calculate completeness percentage for AWS location result.
 * Checks 2 fields: text, placeId.
 *
 * @param result - AWS location result to evaluate
 * @returns Completeness percentage (0-100)
 */
export function calculateAwsCompleteness(result: LocationResult): number {
  const fields = [result.text, result.placeId];
  const nonEmptyCount = fields.filter(f => f && f.trim() !== '').length;
  return (nonEmptyCount / fields.length) * 100;
}

/**
 * Calculate aggregate comparison metrics from PAF and AWS search responses.
 * Returns null if either dataset is undefined.
 *
 * @param pafData - PAF search response
 * @param awsData - AWS location suggest response
 * @returns Comparison metrics or null if data missing
 */
export function calculateComparisonMetrics(
  pafData: PafSearchResponse | undefined,
  awsData: LocationSuggestResponse | undefined
): ComparisonMetrics | null {
  if (!pafData || !awsData) return null;

  // Calculate average completeness
  const pafCompletenessAvg = pafData.results.length > 0
    ? pafData.results.reduce((sum, r) => sum + calculatePafCompleteness(r), 0) / pafData.results.length
    : 0;

  const awsCompletenessAvg = awsData.results.length > 0
    ? awsData.results.reduce((sum, r) => sum + calculateAwsCompleteness(r), 0) / awsData.results.length
    : 0;

  const latencyDifference = Math.abs(pafData.latencyMs - awsData.latencyMs);
  const completenessDifference = Math.abs(pafCompletenessAvg - awsCompletenessAvg);

  return {
    pafLatency: pafData.latencyMs,
    awsLatency: awsData.latencyMs,
    latencyDifference,
    fasterService: pafData.latencyMs < awsData.latencyMs ? 'paf' : 'aws',

    pafCompletenessAvg,
    awsCompletenessAvg,
    completenessDifference,
    moreCompleteService: pafCompletenessAvg > awsCompletenessAvg ? 'paf' : 'aws',

    pafResultCount: pafData.count,
    awsResultCount: awsData.count,

    awsCost: awsData.estimatedCost,
  };
}

/**
 * Get badge variant based on completeness percentage.
 * - >80%: 'default' (green)
 * - 50-80%: 'secondary' (yellow)
 * - <50%: 'destructive' (red)
 *
 * @param completeness - Completeness percentage (0-100)
 * @returns Badge variant
 */
export function getCompletenessBadgeVariant(completeness: number): 'default' | 'secondary' | 'destructive' {
  if (completeness > 80) return 'default';
  if (completeness > 50) return 'secondary';
  return 'destructive';
}
