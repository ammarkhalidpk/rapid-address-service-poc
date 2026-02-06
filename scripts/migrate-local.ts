#!/usr/bin/env npx ts-node

/**
 * Local Data Migration Script
 *
 * Runs the PAF data migration from local SQLite database to OpenSearch Serverless.
 * Use this script when Lambda-based migration is not practical due to:
 * - Native module compilation issues (better-sqlite3)
 * - Performance issues with pure JS SQLite implementations
 *
 * Prerequisites:
 * - AWS credentials configured with OpenSearch Serverless access
 * - SQLite database file (apfdata.db) in project root
 * - OpenSearch index created via init Lambda
 *
 * Usage:
 *   npx ts-node scripts/migrate-local.ts [options]
 *
 * Options:
 *   --batch-size <n>     Records per batch (default: 5000)
 *   --start-offset <n>   Starting record offset (default: 0)
 *   --max-records <n>    Maximum records to process (default: all)
 *   --dry-run            Run without actually indexing
 */

import Database from 'better-sqlite3';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import * as path from 'path';

// Configuration
const CONFIG = {
  dbPath: path.join(__dirname, '..', 'apfdata.db'),
  opensearchEndpoint: 'https://axkssd0xdtwtch3dw4ke.ap-southeast-2.aoss.amazonaws.com',
  opensearchIndex: 'paf-addresses',
  region: 'ap-southeast-2',
  defaultBatchSize: 5000,
};

// Types
interface SqliteRow {
  DELIVY_POINT_ID: number;
  DELIVY_POINT_GROUP_ID: number;
  FLAT_UNIT_TYPE: string | null;
  FLAT_UNIT_NBR: string | null;
  FLOOR_LEVEL_TYPE: string | null;
  FLOOR_LEVEL_NBR: string | null;
  HOUSE_NBR_1: number | null;
  HOUSE_NBR_SFX_1: string | null;
  HOUSE_NBR_2: number | null;
  HOUSE_NBR_SFX_2: string | null;
  LOT_NBR: string | null;
  POSTAL_DELIVERY_NBR: number | null;
  POSTAL_DELIVERY_NBR_PFX: string | null;
  POSTAL_DELIVERY_NBR_SFX: string | null;
  PRIMARY_POINT_IND: string | null;
  STREET_NAME: string | null;
  STREET_TYPE: string | null;
  STREET_SFX: string | null;
  POSTAL_DELIVERY_TYPE: string | null;
  LOCALITY_ID: number;
  LOCALITY_NAME: string;
  POSTCODE: string;
  STATE: string;
  BLDG_PROP_NAME_1: string | null;
}

interface OpenSearchDocument {
  delivery_point_id: number;
  delivery_point_group_id: number;
  unit: { type: string | null; number: string | null; full: string | null } | null;
  floor: { type: string | null; number: string | null; full: string | null } | null;
  building_name: string | null;
  street_number: { first: number | null; first_suffix: string | null; last: number | null; last_suffix: string | null; full: string | null } | null;
  lot_number: string | null;
  postal_delivery: { type: string | null; number: number | null; prefix: string | null; suffix: string | null; full: string | null } | null;
  street: { name: string | null; type: string | null; suffix: string | null; full: string | null } | null;
  locality: { id: number; name: string; postcode: string; state: string };
  primary_point: boolean;
  formatted_address: string;
  formatted_address_short: string;
  search_text: string;
}

// SQL Query
const BATCH_QUERY = `
  SELECT
    dp.DELIVY_POINT_ID, dp.DELIVY_POINT_GROUP_ID,
    dp.FLAT_UNIT_TYPE, dp.FLAT_UNIT_NBR,
    dp.FLOOR_LEVEL_TYPE, dp.FLOOR_LEVEL_NBR,
    dp.HOUSE_NBR_1, dp.HOUSE_NBR_SFX_1, dp.HOUSE_NBR_2, dp.HOUSE_NBR_SFX_2,
    dp.LOT_NBR,
    dp.POSTAL_DELIVERY_NBR, dp.POSTAL_DELIVERY_NBR_PFX, dp.POSTAL_DELIVERY_NBR_SFX,
    dp.PRIMARY_POINT_IND,
    dpg.STREET_NAME, dpg.STREET_TYPE, dpg.STREET_SFX, dpg.POSTAL_DELIVERY_TYPE,
    dpg.LOCALITY_ID,
    l.LOCALITY_NAME, l.POSTCODE, l.STATE,
    b.BLDG_PROP_NAME_1
  FROM DELIVERY_POINT dp
  JOIN DELIVERY_POINT_GROUP dpg ON dp.DELIVY_POINT_GROUP_ID = dpg.DELIVY_POINT_GROUP_ID
  JOIN LOCALITY l ON dpg.LOCALITY_ID = l.LOCALITY_ID
  LEFT JOIN BUILDING b ON dp.DELIVY_POINT_ID = b.DELIVY_POINT_ID
  ORDER BY dp.DELIVY_POINT_ID
  LIMIT ? OFFSET ?
`;

// Transform SQLite row to OpenSearch document
function transformToDocument(row: SqliteRow): OpenSearchDocument {
  // Build unit information
  const unit = row.FLAT_UNIT_TYPE || row.FLAT_UNIT_NBR
    ? {
        type: row.FLAT_UNIT_TYPE,
        number: row.FLAT_UNIT_NBR,
        full: [row.FLAT_UNIT_TYPE, row.FLAT_UNIT_NBR].filter(Boolean).join(' ') || null,
      }
    : null;

  // Build floor information
  const floor = row.FLOOR_LEVEL_TYPE || row.FLOOR_LEVEL_NBR
    ? {
        type: row.FLOOR_LEVEL_TYPE,
        number: row.FLOOR_LEVEL_NBR,
        full: [row.FLOOR_LEVEL_TYPE, row.FLOOR_LEVEL_NBR].filter(Boolean).join(' ') || null,
      }
    : null;

  // Build street number
  const streetNumber = row.HOUSE_NBR_1
    ? {
        first: row.HOUSE_NBR_1,
        first_suffix: row.HOUSE_NBR_SFX_1,
        last: row.HOUSE_NBR_2,
        last_suffix: row.HOUSE_NBR_SFX_2,
        full: buildStreetNumberString(row),
      }
    : null;

  // Build postal delivery information
  const postalDelivery = row.POSTAL_DELIVERY_TYPE || row.POSTAL_DELIVERY_NBR
    ? {
        type: row.POSTAL_DELIVERY_TYPE,
        number: row.POSTAL_DELIVERY_NBR,
        prefix: row.POSTAL_DELIVERY_NBR_PFX,
        suffix: row.POSTAL_DELIVERY_NBR_SFX,
        full: buildPostalDeliveryString(row),
      }
    : null;

  // Build street information
  const street = row.STREET_NAME
    ? {
        name: row.STREET_NAME,
        type: row.STREET_TYPE,
        suffix: row.STREET_SFX,
        full: [row.STREET_NAME, row.STREET_TYPE, row.STREET_SFX].filter(Boolean).join(' ') || null,
      }
    : null;

  // Build formatted addresses
  const formattedAddress = buildFormattedAddress(row);
  const formattedAddressShort = buildFormattedAddressShort(row);
  const searchText = buildSearchText(row);

  return {
    delivery_point_id: row.DELIVY_POINT_ID,
    delivery_point_group_id: row.DELIVY_POINT_GROUP_ID,
    unit,
    floor,
    building_name: row.BLDG_PROP_NAME_1,
    street_number: streetNumber,
    lot_number: row.LOT_NBR,
    postal_delivery: postalDelivery,
    street,
    locality: {
      id: row.LOCALITY_ID,
      name: row.LOCALITY_NAME,
      postcode: row.POSTCODE,
      state: row.STATE,
    },
    primary_point: row.PRIMARY_POINT_IND === 'Y',
    formatted_address: formattedAddress,
    formatted_address_short: formattedAddressShort,
    search_text: searchText,
  };
}

function buildStreetNumberString(row: SqliteRow): string | null {
  if (!row.HOUSE_NBR_1) return null;

  let result = `${row.HOUSE_NBR_1}`;
  if (row.HOUSE_NBR_SFX_1) result += row.HOUSE_NBR_SFX_1;

  if (row.HOUSE_NBR_2) {
    result += `-${row.HOUSE_NBR_2}`;
    if (row.HOUSE_NBR_SFX_2) result += row.HOUSE_NBR_SFX_2;
  }

  return result;
}

function buildPostalDeliveryString(row: SqliteRow): string | null {
  const parts: string[] = [];
  if (row.POSTAL_DELIVERY_TYPE) parts.push(row.POSTAL_DELIVERY_TYPE);
  if (row.POSTAL_DELIVERY_NBR_PFX) parts.push(row.POSTAL_DELIVERY_NBR_PFX);
  if (row.POSTAL_DELIVERY_NBR) parts.push(row.POSTAL_DELIVERY_NBR.toString());
  if (row.POSTAL_DELIVERY_NBR_SFX) parts.push(row.POSTAL_DELIVERY_NBR_SFX);
  return parts.length > 0 ? parts.join(' ') : null;
}

function buildFormattedAddress(row: SqliteRow): string {
  const parts: string[] = [];

  // Unit/Flat
  if (row.FLAT_UNIT_TYPE || row.FLAT_UNIT_NBR) {
    parts.push([row.FLAT_UNIT_TYPE, row.FLAT_UNIT_NBR].filter(Boolean).join(' '));
  }

  // Floor
  if (row.FLOOR_LEVEL_TYPE || row.FLOOR_LEVEL_NBR) {
    parts.push([row.FLOOR_LEVEL_TYPE, row.FLOOR_LEVEL_NBR].filter(Boolean).join(' '));
  }

  // Building name
  if (row.BLDG_PROP_NAME_1) {
    parts.push(row.BLDG_PROP_NAME_1);
  }

  // Street number
  const streetNum = buildStreetNumberString(row);
  if (streetNum) {
    parts.push(streetNum);
  }

  // Street name
  if (row.STREET_NAME) {
    parts.push([row.STREET_NAME, row.STREET_TYPE, row.STREET_SFX].filter(Boolean).join(' '));
  }

  // Postal delivery (if no street)
  if (!row.STREET_NAME && row.POSTAL_DELIVERY_TYPE) {
    parts.push(buildPostalDeliveryString(row) || '');
  }

  // Locality, State, Postcode
  parts.push(`${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`);

  return parts.filter(Boolean).join(', ').replace(/,\s+,/g, ',').replace(/^,\s*/, '');
}

function buildFormattedAddressShort(row: SqliteRow): string {
  const parts: string[] = [];

  // Street number and name (or postal delivery)
  const streetNum = buildStreetNumberString(row);
  if (streetNum && row.STREET_NAME) {
    parts.push(`${streetNum} ${[row.STREET_NAME, row.STREET_TYPE, row.STREET_SFX].filter(Boolean).join(' ')}`);
  } else if (row.POSTAL_DELIVERY_TYPE) {
    parts.push(buildPostalDeliveryString(row) || '');
  }

  // Locality, State, Postcode
  parts.push(`${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`);

  return parts.filter(Boolean).join(', ');
}

function buildSearchText(row: SqliteRow): string {
  const parts: string[] = [];

  // Add all searchable text
  if (row.FLAT_UNIT_TYPE) parts.push(row.FLAT_UNIT_TYPE);
  if (row.FLAT_UNIT_NBR) parts.push(row.FLAT_UNIT_NBR);
  if (row.BLDG_PROP_NAME_1) parts.push(row.BLDG_PROP_NAME_1);

  const streetNum = buildStreetNumberString(row);
  if (streetNum) parts.push(streetNum);

  if (row.STREET_NAME) parts.push(row.STREET_NAME);
  if (row.STREET_TYPE) parts.push(row.STREET_TYPE);
  if (row.POSTAL_DELIVERY_TYPE) parts.push(row.POSTAL_DELIVERY_TYPE);
  if (row.POSTAL_DELIVERY_NBR) parts.push(row.POSTAL_DELIVERY_NBR.toString());

  parts.push(row.LOCALITY_NAME);
  parts.push(row.STATE);
  parts.push(row.POSTCODE);

  return parts.filter(Boolean).join(' ');
}

// Parse command line arguments
function parseArgs(): { batchSize: number; startOffset: number; maxRecords: number | null; dryRun: boolean } {
  const args = process.argv.slice(2);
  const result = {
    batchSize: CONFIG.defaultBatchSize,
    startOffset: 0,
    maxRecords: null as number | null,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-size' && args[i + 1]) {
      result.batchSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--start-offset' && args[i + 1]) {
      result.startOffset = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--max-records' && args[i + 1]) {
      result.maxRecords = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main migration function
async function migrate() {
  const args = parseArgs();

  console.log('=== PAF Data Migration (Local) ===');
  console.log(`Database: ${CONFIG.dbPath}`);
  console.log(`OpenSearch: ${CONFIG.opensearchEndpoint}`);
  console.log(`Index: ${CONFIG.opensearchIndex}`);
  console.log(`Batch size: ${args.batchSize}`);
  console.log(`Start offset: ${args.startOffset}`);
  console.log(`Max records: ${args.maxRecords || 'all'}`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log('');

  // Initialize database
  console.log('Opening database...');
  const db = new Database(CONFIG.dbPath, { readonly: true });

  // Get total count
  const countResult = db.prepare('SELECT COUNT(*) as total FROM DELIVERY_POINT').get() as { total: number };
  const totalRecords = countResult.total;
  console.log(`Total records in database: ${totalRecords.toLocaleString()}`);

  // Calculate records to process
  const recordsToProcess = args.maxRecords
    ? Math.min(args.maxRecords, totalRecords - args.startOffset)
    : totalRecords - args.startOffset;
  console.log(`Records to process: ${recordsToProcess.toLocaleString()}`);
  console.log('');

  // Initialize OpenSearch client
  let client: Client | null = null;
  if (!args.dryRun) {
    console.log('Initializing OpenSearch client...');
    client = new Client({
      ...AwsSigv4Signer({
        region: CONFIG.region,
        service: 'aoss',
        getCredentials: () => defaultProvider()(),
      }),
      node: CONFIG.opensearchEndpoint,
    });

    // Verify connection
    try {
      const countResponse = await client.count({ index: CONFIG.opensearchIndex });
      console.log(`Current index document count: ${countResponse.body.count.toLocaleString()}`);
    } catch (error: any) {
      if (error?.meta?.statusCode === 404) {
        console.error('ERROR: Index does not exist. Run the init Lambda first.');
        process.exit(1);
      }
      console.error('Failed to connect to OpenSearch:', error);
      process.exit(1);
    }
  }

  // Prepare batch query
  const batchStmt = db.prepare(BATCH_QUERY);

  // Migration stats
  const startTime = Date.now();
  let processedRecords = 0;
  let indexedRecords = 0;
  let failedRecords = 0;
  let batchNumber = 0;
  let currentOffset = args.startOffset;
  let remainingRecords = recordsToProcess;

  console.log('Starting migration...\n');

  while (remainingRecords > 0) {
    const batchStartTime = Date.now();
    batchNumber++;

    const currentBatchSize = Math.min(args.batchSize, remainingRecords);
    console.log(`=== Batch ${batchNumber}: Processing ${currentBatchSize.toLocaleString()} records at offset ${currentOffset.toLocaleString()} ===`);

    try {
      // Read batch from database
      const rows = batchStmt.all(currentBatchSize, currentOffset) as SqliteRow[];

      if (rows.length === 0) {
        console.log('No more records to process');
        break;
      }

      console.log(`Read ${rows.length.toLocaleString()} rows from database`);

      // Transform rows to documents
      const documents = rows.map(transformToDocument);
      console.log(`Transformed ${documents.length.toLocaleString()} documents`);

      if (!args.dryRun && client) {
        // Build bulk request
        const bulkBody = documents.flatMap(doc => [
          { index: { _index: CONFIG.opensearchIndex, _id: doc.delivery_point_id.toString() } },
          doc,
        ]);

        // Execute bulk request with retry
        let indexed = 0;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          try {
            const response = await client.bulk({
              body: bulkBody,
              refresh: false,
            });

            if (response.body.errors) {
              const errorItems = response.body.items.filter((item: any) => item.index?.error);
              const errorCount = errorItems.length;
              console.log(`Indexed with ${errorCount} errors`);
              // Log first 3 errors for debugging
              if (errorCount > 0) {
                console.log('Sample errors:');
                errorItems.slice(0, 3).forEach((item: any) => {
                  console.log(`  - ${item.index._id}: ${item.index.error.type} - ${item.index.error.reason}`);
                });
              }
              indexed = documents.length - errorCount;
            } else {
              indexed = documents.length;
            }
            break;
          } catch (error: any) {
            retries++;
            if (retries < maxRetries) {
              console.log(`Bulk request failed, retrying (${retries}/${maxRetries})...`);
              await sleep(1000 * retries);
            } else {
              console.error('Bulk request failed after retries:', error.message);
              indexed = 0;
            }
          }
        }

        indexedRecords += indexed;
        failedRecords += documents.length - indexed;
        console.log(`Indexed: ${indexed.toLocaleString()} documents`);
      } else {
        // Dry run - count as success
        indexedRecords += documents.length;
        console.log(`[DRY RUN] Would index: ${documents.length.toLocaleString()} documents`);
      }

      processedRecords += rows.length;
      currentOffset += rows.length;
      remainingRecords -= rows.length;

      // Progress
      const batchDuration = Date.now() - batchStartTime;
      const totalElapsed = Date.now() - startTime;
      const progressPercent = ((processedRecords / recordsToProcess) * 100).toFixed(2);
      const avgBatchTime = totalElapsed / batchNumber;
      const remainingBatches = Math.ceil(remainingRecords / args.batchSize);
      const estimatedRemaining = (remainingBatches * avgBatchTime) / 1000 / 60;

      console.log(`Batch completed in ${(batchDuration / 1000).toFixed(1)}s`);
      console.log(`Progress: ${processedRecords.toLocaleString()}/${recordsToProcess.toLocaleString()} (${progressPercent}%)`);
      console.log(`Total indexed: ${indexedRecords.toLocaleString()}, Failed: ${failedRecords.toLocaleString()}`);
      console.log(`Estimated time remaining: ${estimatedRemaining.toFixed(1)} minutes`);
      console.log('');

    } catch (error) {
      console.error(`Batch ${batchNumber} failed:`, error);
      failedRecords += currentBatchSize;
      currentOffset += currentBatchSize;
      remainingRecords -= currentBatchSize;
    }
  }

  // Final refresh
  if (!args.dryRun && client) {
    console.log('Refreshing index...');
    try {
      await client.indices.refresh({ index: CONFIG.opensearchIndex });
      const finalCount = await client.count({ index: CONFIG.opensearchIndex });
      console.log(`Final document count: ${finalCount.body.count.toLocaleString()}`);
    } catch (error) {
      console.error('Failed to refresh index:', error);
    }
  }

  // Close database
  db.close();

  // Final stats
  const totalDuration = Date.now() - startTime;
  const avgRecordsPerSecond = Math.round((processedRecords / totalDuration) * 1000);

  console.log('\n=== Migration Complete ===');
  console.log(`Total duration: ${(totalDuration / 1000 / 60).toFixed(2)} minutes`);
  console.log(`Records processed: ${processedRecords.toLocaleString()}`);
  console.log(`Records indexed: ${indexedRecords.toLocaleString()}`);
  console.log(`Records failed: ${failedRecords.toLocaleString()}`);
  console.log(`Average throughput: ${avgRecordsPerSecond.toLocaleString()} records/second`);
  console.log(`Batches processed: ${batchNumber}`);
}

// Run migration
migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
