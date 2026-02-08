import { describe, it, expect } from 'vitest';
import {
  calculatePafCompleteness,
  calculateAwsCompleteness,
  calculateComparisonMetrics,
  getCompletenessBadgeVariant,
  type ComparisonMetrics
} from './comparison-utils';
import type { PafAddressResult, LocationResult, PafSearchResponse, LocationSuggestResponse } from '@/types';

describe('calculatePafCompleteness', () => {
  it('should return 100% for fully populated result', () => {
    const result: PafAddressResult = {
      id: 'test-id',
      address: '123 Main St, Melbourne VIC 3000',
      addressShort: '123 Main St',
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'VIC',
      street: 'Main St',
      streetNumber: '123',
      unit: 'Unit 1',
      buildingName: 'Building A',
      score: 9.5,
    };

    expect(calculatePafCompleteness(result)).toBe(100);
  });

  it('should return 50% when half fields are empty', () => {
    const result: PafAddressResult = {
      id: 'test-id',
      address: '123 Main St, Melbourne VIC 3000',
      addressShort: '123 Main St',
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'VIC',
      street: '',
      streetNumber: '',
      unit: '',
      buildingName: '',
      score: 9.5,
    };

    expect(calculatePafCompleteness(result)).toBe(60); // 6 out of 10 fields
  });

  it('should handle empty strings as incomplete', () => {
    const result: PafAddressResult = {
      id: 'test-id',
      address: '',
      addressShort: '123 Main St',
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'VIC',
      street: 'Main St',
      streetNumber: '123',
      unit: '',
      buildingName: '',
      score: 9.5,
    };

    expect(calculatePafCompleteness(result)).toBe(70); // 7 out of 10 fields
  });

  it('should handle whitespace-only strings as incomplete', () => {
    const result: PafAddressResult = {
      id: 'test-id',
      address: '   ',
      addressShort: '123 Main St',
      suburb: 'Melbourne',
      postcode: '3000',
      state: 'VIC',
      street: 'Main St',
      streetNumber: '123',
      unit: '',
      buildingName: '',
      score: 9.5,
    };

    expect(calculatePafCompleteness(result)).toBe(70); // 7 out of 10 fields (whitespace doesn't count)
  });

  it('should return 0% when all fields are empty', () => {
    const result: PafAddressResult = {
      id: '',
      address: '',
      addressShort: '',
      suburb: '',
      postcode: '',
      state: '',
      street: '',
      streetNumber: '',
      unit: '',
      buildingName: '',
      score: 0,
    };

    expect(calculatePafCompleteness(result)).toBe(0);
  });
});

describe('calculateAwsCompleteness', () => {
  it('should return 100% when both fields present', () => {
    const result: LocationResult = {
      text: '123 Main St, Melbourne VIC 3000',
      placeId: 'xyz123',
    };

    expect(calculateAwsCompleteness(result)).toBe(100);
  });

  it('should return 50% when placeId missing', () => {
    const result: LocationResult = {
      text: '123 Main St, Melbourne VIC 3000',
      placeId: '',
    };

    expect(calculateAwsCompleteness(result)).toBe(50);
  });

  it('should return 50% when text missing', () => {
    const result: LocationResult = {
      text: '',
      placeId: 'xyz123',
    };

    expect(calculateAwsCompleteness(result)).toBe(50);
  });

  it('should return 0% when both fields missing', () => {
    const result: LocationResult = {
      text: '',
      placeId: '',
    };

    expect(calculateAwsCompleteness(result)).toBe(0);
  });

  it('should handle whitespace-only strings as incomplete', () => {
    const result: LocationResult = {
      text: '   ',
      placeId: 'xyz123',
    };

    expect(calculateAwsCompleteness(result)).toBe(50);
  });
});

describe('calculateComparisonMetrics', () => {
  const mockPafData: PafSearchResponse = {
    query: 'test',
    results: [
      {
        id: 'test-1',
        address: '123 Main St, Melbourne VIC 3000',
        addressShort: '123 Main St',
        suburb: 'Melbourne',
        postcode: '3000',
        state: 'VIC',
        street: 'Main St',
        streetNumber: '123',
        unit: '',
        buildingName: '',
        score: 9.5,
      },
      {
        id: 'test-2',
        address: '456 High St, Sydney NSW 2000',
        addressShort: '456 High St',
        suburb: 'Sydney',
        postcode: '2000',
        state: 'NSW',
        street: 'High St',
        streetNumber: '456',
        unit: 'Unit 2',
        buildingName: 'Tower B',
        score: 8.7,
      },
    ],
    count: 2,
    total: 2,
    source: 'PAF',
    latencyMs: 145,
  };

  const mockAwsData: LocationSuggestResponse = {
    results: [
      {
        text: '123 Main Street, Melbourne VIC 3000',
        placeId: 'aws-place-1',
      },
      {
        text: '456 High Street, Sydney NSW 2000',
        placeId: 'aws-place-2',
      },
    ],
    count: 2,
    latencyMs: 280,
    estimatedCost: 0.0025,
  };

  it('should return null when pafData is undefined', () => {
    expect(calculateComparisonMetrics(undefined, mockAwsData)).toBeNull();
  });

  it('should return null when awsData is undefined', () => {
    expect(calculateComparisonMetrics(mockPafData, undefined)).toBeNull();
  });

  it('should return null when both datasets are undefined', () => {
    expect(calculateComparisonMetrics(undefined, undefined)).toBeNull();
  });

  it('should correctly identify faster service (PAF faster)', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData);
    expect(metrics?.fasterService).toBe('paf');
    expect(metrics?.latencyDifference).toBe(135);
  });

  it('should correctly identify faster service (AWS faster)', () => {
    const fastAwsData = { ...mockAwsData, latencyMs: 100 };
    const metrics = calculateComparisonMetrics(mockPafData, fastAwsData);
    expect(metrics?.fasterService).toBe('aws');
    expect(metrics?.latencyDifference).toBe(45);
  });

  it('should calculate average PAF completeness correctly', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData);
    // First result: 8/10 = 80%, Second result: 10/10 = 100%
    // Average: (80 + 100) / 2 = 90%
    expect(metrics?.pafCompletenessAvg).toBe(90);
  });

  it('should calculate average AWS completeness correctly', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData);
    // Both results have text and placeId = 100% each
    // Average: (100 + 100) / 2 = 100%
    expect(metrics?.awsCompletenessAvg).toBe(100);
  });

  it('should correctly identify more complete service', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData);
    expect(metrics?.moreCompleteService).toBe('aws');
  });

  it('should calculate completeness difference correctly', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData);
    // AWS: 100%, PAF: 90% -> difference = 10%
    expect(metrics?.completenessDifference).toBe(10);
  });

  it('should handle zero results in PAF', () => {
    const emptyPafData = { ...mockPafData, results: [], count: 0 };
    const metrics = calculateComparisonMetrics(emptyPafData, mockAwsData);
    expect(metrics?.pafCompletenessAvg).toBe(0);
    expect(metrics?.pafResultCount).toBe(0);
  });

  it('should handle zero results in AWS', () => {
    const emptyAwsData = { ...mockAwsData, results: [], count: 0 };
    const metrics = calculateComparisonMetrics(mockPafData, emptyAwsData);
    expect(metrics?.awsCompletenessAvg).toBe(0);
    expect(metrics?.awsResultCount).toBe(0);
  });

  it('should include all required metric fields', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData) as ComparisonMetrics;

    expect(metrics).toHaveProperty('pafLatency');
    expect(metrics).toHaveProperty('awsLatency');
    expect(metrics).toHaveProperty('latencyDifference');
    expect(metrics).toHaveProperty('fasterService');
    expect(metrics).toHaveProperty('pafCompletenessAvg');
    expect(metrics).toHaveProperty('awsCompletenessAvg');
    expect(metrics).toHaveProperty('completenessDifference');
    expect(metrics).toHaveProperty('moreCompleteService');
    expect(metrics).toHaveProperty('pafResultCount');
    expect(metrics).toHaveProperty('awsResultCount');
    expect(metrics).toHaveProperty('awsCost');
  });

  it('should correctly populate result counts', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData);
    expect(metrics?.pafResultCount).toBe(2);
    expect(metrics?.awsResultCount).toBe(2);
  });

  it('should correctly populate AWS cost', () => {
    const metrics = calculateComparisonMetrics(mockPafData, mockAwsData);
    expect(metrics?.awsCost).toBe(0.0025);
  });
});

describe('getCompletenessBadgeVariant', () => {
  it('should return "default" for completeness > 80%', () => {
    expect(getCompletenessBadgeVariant(81)).toBe('default');
    expect(getCompletenessBadgeVariant(90)).toBe('default');
    expect(getCompletenessBadgeVariant(100)).toBe('default');
  });

  it('should return "secondary" for completeness 50-80%', () => {
    expect(getCompletenessBadgeVariant(51)).toBe('secondary');
    expect(getCompletenessBadgeVariant(70)).toBe('secondary');
    expect(getCompletenessBadgeVariant(80)).toBe('secondary');
  });

  it('should return "destructive" for completeness < 50%', () => {
    expect(getCompletenessBadgeVariant(0)).toBe('destructive');
    expect(getCompletenessBadgeVariant(25)).toBe('destructive');
    expect(getCompletenessBadgeVariant(50)).toBe('destructive');
  });

  it('should handle boundary values correctly', () => {
    expect(getCompletenessBadgeVariant(80)).toBe('secondary');
    expect(getCompletenessBadgeVariant(80.1)).toBe('default');
    expect(getCompletenessBadgeVariant(50)).toBe('destructive');
    expect(getCompletenessBadgeVariant(50.1)).toBe('secondary');
  });
});
