#!/usr/bin/env npx ts-node

/**
 * Validation Suite for Data Migration - RAS-19
 *
 * Tests:
 * 1. Record count validation (target 95%+ coverage: >= 15M records)
 * 2. Query validation with sample address queries
 * 3. Field searchability validation for autocomplete fields
 * 4. Performance benchmarking for API latency (p95 < 500ms)
 *
 * Usage:
 *   npx ts-node scripts/validate-migration.ts
 */

import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import axios from 'axios';

const AWS_PROFILE = 'fbdms';

const CONFIG = {
  opensearchEndpoint: 'https://xxc3y25wjttu3kt8pv71.ap-southeast-2.aoss.amazonaws.com',
  opensearchIndex: 'paf-addresses',
  region: 'ap-southeast-2',
  apiEndpoint: 'https://f0uo0m26t6.execute-api.ap-southeast-2.amazonaws.com/dev/autocomplete/paf',
  apiKey: 'fNFMbC6F3dxZ5uD76ntO8yaaFZNuWWc7W1NGeJt2',
  expectedMinRecords: 15_000_000, // 15M records (95%+ of 15.17M)
  p95LatencyThreshold: 500, // milliseconds
};

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

interface PerformanceMetrics {
  latencies: number[];
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

const results: ValidationResult[] = [];

function logResult(result: ValidationResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✓' : '✗';
  console.log(`${icon} ${result.test}: ${result.message}`);
  if (result.details) {
    console.log(`  Details: ${JSON.stringify(result.details)}`);
  }
}

async function validateRecordCount(client: Client): Promise<void> {
  console.log('\n=== Test 1: Record Count Validation ===\n');

  try {
    const countResponse = await client.count({ index: CONFIG.opensearchIndex });
    const documentCount = countResponse.body.count;

    if (documentCount >= CONFIG.expectedMinRecords) {
      logResult({
        test: 'Record Count',
        status: 'PASS',
        message: `OpenSearch has ${documentCount.toLocaleString()} records (>= ${CONFIG.expectedMinRecords.toLocaleString()})`,
        details: { count: documentCount, threshold: CONFIG.expectedMinRecords },
      });
    } else {
      logResult({
        test: 'Record Count',
        status: 'FAIL',
        message: `OpenSearch has ${documentCount.toLocaleString()} records (< ${CONFIG.expectedMinRecords.toLocaleString()})`,
        details: { count: documentCount, threshold: CONFIG.expectedMinRecords },
      });
    }
  } catch (error: any) {
    logResult({
      test: 'Record Count',
      status: 'FAIL',
      message: `Failed to query record count: ${error.message}`,
    });
  }
}

async function validateQueryResults(): Promise<void> {
  console.log('\n=== Test 2: Query Validation with Sample Addresses ===\n');

  const testQueries = [
    { query: 'george street sydney', expectedField: 'street.name' },
    { query: 'melbourne 3000', expectedField: 'locality.postcode' },
    { query: 'parramatta', expectedField: 'locality.name' },
  ];

  for (const testQuery of testQueries) {
    try {
      const response = await axios.get(CONFIG.apiEndpoint, {
        params: { query: testQuery.query, limit: 10 },
        headers: { 'x-api-key': CONFIG.apiKey },
        timeout: 5000,
      });

      if (response.status === 200 && response.data) {
        const data = response.data as any;
        const results = data.results || data;
        const resultCount = Array.isArray(results) ? results.length : 0;

        if (resultCount > 0) {
          logResult({
            test: `Query: "${testQuery.query}"`,
            status: 'PASS',
            message: `Returned ${resultCount} results`,
            details: {
              query: testQuery.query,
              results: resultCount,
              sample: results[0]?.address || results[0]?.formatted_address || results[0],
            },
          });
        } else {
          logResult({
            test: `Query: "${testQuery.query}"`,
            status: 'FAIL',
            message: 'No results returned',
            details: { query: testQuery.query },
          });
        }
      } else {
        logResult({
          test: `Query: "${testQuery.query}"`,
          status: 'FAIL',
          message: 'Invalid response format',
          details: { status: response.status },
        });
      }
    } catch (error: any) {
      logResult({
        test: `Query: "${testQuery.query}"`,
        status: 'FAIL',
        message: `Request failed: ${error.message}`,
      });
    }
  }
}

async function validateFieldSearchability(client: Client): Promise<void> {
  console.log('\n=== Test 3: Field Searchability Validation ===\n');

  const autocompleteFields = [
    'search_text.autocomplete',
    'formatted_address.autocomplete',
    'street.name.autocomplete',
    'street.full.autocomplete',
    'locality.name.autocomplete',
    'building_name.autocomplete',
  ];

  for (const field of autocompleteFields) {
    try {
      const searchResponse = await client.search({
        index: CONFIG.opensearchIndex,
        body: {
          query: {
            match: {
              [field]: 'george',
            },
          },
          size: 5,
        },
      });

      const total = searchResponse.body.hits.total;
      const hits = typeof total === 'number' ? total : total?.value || 0;
      if (hits > 0) {
        logResult({
          test: `Field: ${field}`,
          status: 'PASS',
          message: `Field is searchable (${hits.toLocaleString()} matches for "george")`,
          details: { field, hits },
        });
      } else {
        logResult({
          test: `Field: ${field}`,
          status: 'FAIL',
          message: 'Field returned no results',
          details: { field },
        });
      }
    } catch (error: any) {
      logResult({
        test: `Field: ${field}`,
        status: 'FAIL',
        message: `Search failed: ${error.message}`,
      });
    }
  }
}

async function benchmarkPerformance(): Promise<void> {
  console.log('\n=== Test 4: Performance Benchmarking ===\n');

  const testQueries = [
    'george street sydney',
    'melbourne 3000',
    'parramatta',
    'collins street',
    'bondi 2026',
    'brisbane',
    'perth',
    'main street',
    'king street',
    'victoria road',
  ];

  const latencies: number[] = [];

  console.log('Running 10 test queries...\n');

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    const startTime = Date.now();

    try {
      await axios.get(CONFIG.apiEndpoint, {
        params: { query: query, limit: 10 },
        headers: { 'x-api-key': CONFIG.apiKey },
        timeout: 5000,
      });

      const latency = Date.now() - startTime;
      latencies.push(latency);
      console.log(`  Query ${i + 1}/10: "${query}" - ${latency}ms`);
    } catch (error: any) {
      console.log(`  Query ${i + 1}/10: "${query}" - FAILED: ${error.message}`);
    }
  }

  if (latencies.length > 0) {
    const metrics = calculateMetrics(latencies);

    console.log('\nPerformance Metrics:');
    console.log(`  Min: ${metrics.min}ms`);
    console.log(`  Avg: ${metrics.avg.toFixed(2)}ms`);
    console.log(`  P50: ${metrics.p50}ms`);
    console.log(`  P95: ${metrics.p95}ms`);
    console.log(`  P99: ${metrics.p99}ms`);
    console.log(`  Max: ${metrics.max}ms`);

    if (metrics.p95 < CONFIG.p95LatencyThreshold) {
      logResult({
        test: 'Performance Benchmark',
        status: 'PASS',
        message: `P95 latency ${metrics.p95}ms < ${CONFIG.p95LatencyThreshold}ms threshold`,
        details: metrics,
      });
    } else {
      logResult({
        test: 'Performance Benchmark',
        status: 'FAIL',
        message: `P95 latency ${metrics.p95}ms >= ${CONFIG.p95LatencyThreshold}ms threshold`,
        details: metrics,
      });
    }
  } else {
    logResult({
      test: 'Performance Benchmark',
      status: 'FAIL',
      message: 'No successful queries to measure',
    });
  }
}

function calculateMetrics(latencies: number[]): PerformanceMetrics {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    latencies: sorted,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function percentile(sortedArray: number[], p: number): number {
  const index = Math.ceil((p / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

function printSummary() {
  console.log('\n==========================================================');
  console.log('                   VALIDATION SUMMARY');
  console.log('==========================================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    console.log('');
  }

  console.log('==========================================================');
  console.log(`Overall Status: ${failed === 0 ? '✓ PASS' : '✗ FAIL'}`);
  console.log('==========================================================\n');
}

async function runValidation() {
  console.log('==========================================================');
  console.log('     Data Migration Validation Suite - RAS-19');
  console.log('==========================================================');
  console.log(`OpenSearch Endpoint: ${CONFIG.opensearchEndpoint}`);
  console.log(`Index: ${CONFIG.opensearchIndex}`);
  console.log(`API Endpoint: ${CONFIG.apiEndpoint}`);
  console.log(`AWS Profile: ${AWS_PROFILE}`);
  console.log('==========================================================');

  // Initialize OpenSearch client
  const credentialsProvider = fromIni({ profile: AWS_PROFILE });
  const client = new Client({
    ...AwsSigv4Signer({
      region: CONFIG.region,
      service: 'aoss',
      getCredentials: () => credentialsProvider(),
    }),
    node: CONFIG.opensearchEndpoint,
  });

  // Run validation tests
  await validateRecordCount(client);
  await validateQueryResults();
  await validateFieldSearchability(client);
  await benchmarkPerformance();

  // Print summary
  printSummary();

  // Exit with appropriate code
  const failed = results.filter(r => r.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

runValidation().catch(error => {
  console.error('\nValidation failed with error:', error);
  process.exit(1);
});
