#!/usr/bin/env npx ts-node

/**
 * Export PAF data from SQLite to NDJSON format for OpenSearch bulk ingestion
 *
 * This script:
 * 1. Reads records from SQLite in batches
 * 2. Transforms to OpenSearch document format
 * 3. Writes NDJSON files (with bulk API format)
 * 4. Optionally uploads to S3
 *
 * Usage:
 *   npx ts-node scripts/export-to-ndjson.ts [options]
 *
 * Options:
 *   --output-dir <dir>     Output directory (default: ./export)
 *   --records-per-file <n> Records per NDJSON file (default: 100000)
 *   --upload-s3            Upload files to S3 after export
 *   --s3-prefix <prefix>   S3 prefix (default: paf-export/)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configuration
const CONFIG = {
  dbPath: path.join(__dirname, '..', 'apfdata.db'),
  defaultOutputDir: path.join(__dirname, '..', 'export'),
  defaultRecordsPerFile: 100000,
  s3Bucket: 'rapid-address-dev-data',
  s3Prefix: 'paf-export/',
  indexName: 'paf-addresses',
  region: 'ap-southeast-2',
};

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

// Transform function (same as migrate-local.ts)
function transformToDocument(row: SqliteRow): any {
  const unit = row.FLAT_UNIT_TYPE || row.FLAT_UNIT_NBR
    ? {
        type: row.FLAT_UNIT_TYPE,
        number: row.FLAT_UNIT_NBR,
        full: [row.FLAT_UNIT_TYPE, row.FLAT_UNIT_NBR].filter(Boolean).join(' ') || null,
      }
    : null;

  const floor = row.FLOOR_LEVEL_TYPE || row.FLOOR_LEVEL_NBR
    ? {
        type: row.FLOOR_LEVEL_TYPE,
        number: row.FLOOR_LEVEL_NBR,
        full: [row.FLOOR_LEVEL_TYPE, row.FLOOR_LEVEL_NBR].filter(Boolean).join(' ') || null,
      }
    : null;

  const streetNumber = row.HOUSE_NBR_1
    ? {
        first: row.HOUSE_NBR_1,
        first_suffix: row.HOUSE_NBR_SFX_1,
        last: row.HOUSE_NBR_2,
        last_suffix: row.HOUSE_NBR_SFX_2,
        full: buildStreetNumberString(row),
      }
    : null;

  const postalDelivery = row.POSTAL_DELIVERY_TYPE || row.POSTAL_DELIVERY_NBR
    ? {
        type: row.POSTAL_DELIVERY_TYPE,
        number: row.POSTAL_DELIVERY_NBR,
        prefix: row.POSTAL_DELIVERY_NBR_PFX,
        suffix: row.POSTAL_DELIVERY_NBR_SFX,
        full: buildPostalDeliveryString(row),
      }
    : null;

  const street = row.STREET_NAME
    ? {
        name: row.STREET_NAME,
        type: row.STREET_TYPE,
        suffix: row.STREET_SFX,
        full: [row.STREET_NAME, row.STREET_TYPE, row.STREET_SFX].filter(Boolean).join(' ') || null,
      }
    : null;

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
    formatted_address: buildFormattedAddress(row),
    formatted_address_short: buildFormattedAddressShort(row),
    search_text: buildSearchText(row),
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
  if (row.FLAT_UNIT_TYPE || row.FLAT_UNIT_NBR) {
    parts.push([row.FLAT_UNIT_TYPE, row.FLAT_UNIT_NBR].filter(Boolean).join(' '));
  }
  if (row.FLOOR_LEVEL_TYPE || row.FLOOR_LEVEL_NBR) {
    parts.push([row.FLOOR_LEVEL_TYPE, row.FLOOR_LEVEL_NBR].filter(Boolean).join(' '));
  }
  if (row.BLDG_PROP_NAME_1) {
    parts.push(row.BLDG_PROP_NAME_1);
  }
  const streetNum = buildStreetNumberString(row);
  if (streetNum) {
    parts.push(streetNum);
  }
  if (row.STREET_NAME) {
    parts.push([row.STREET_NAME, row.STREET_TYPE, row.STREET_SFX].filter(Boolean).join(' '));
  }
  if (!row.STREET_NAME && row.POSTAL_DELIVERY_TYPE) {
    parts.push(buildPostalDeliveryString(row) || '');
  }
  parts.push(`${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`);
  return parts.filter(Boolean).join(', ').replace(/,\s+,/g, ',').replace(/^,\s*/, '');
}

function buildFormattedAddressShort(row: SqliteRow): string {
  const parts: string[] = [];
  const streetNum = buildStreetNumberString(row);
  if (streetNum && row.STREET_NAME) {
    parts.push(`${streetNum} ${[row.STREET_NAME, row.STREET_TYPE, row.STREET_SFX].filter(Boolean).join(' ')}`);
  } else if (row.POSTAL_DELIVERY_TYPE) {
    parts.push(buildPostalDeliveryString(row) || '');
  }
  parts.push(`${row.LOCALITY_NAME} ${row.STATE} ${row.POSTCODE}`);
  return parts.filter(Boolean).join(', ');
}

function buildSearchText(row: SqliteRow): string {
  const parts: string[] = [];
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

// Parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    outputDir: CONFIG.defaultOutputDir,
    recordsPerFile: CONFIG.defaultRecordsPerFile,
    uploadS3: false,
    s3Prefix: CONFIG.s3Prefix,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      result.outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--records-per-file' && args[i + 1]) {
      result.recordsPerFile = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--upload-s3') {
      result.uploadS3 = true;
    } else if (args[i] === '--s3-prefix' && args[i + 1]) {
      result.s3Prefix = args[i + 1];
      i++;
    }
  }

  return result;
}

async function uploadToS3(filePath: string, s3Key: string) {
  const s3Client = new S3Client({ region: CONFIG.region });
  const fileContent = fs.readFileSync(filePath);

  await s3Client.send(new PutObjectCommand({
    Bucket: CONFIG.s3Bucket,
    Key: s3Key,
    Body: fileContent,
    ContentType: 'application/x-ndjson',
  }));
}

async function main() {
  const args = parseArgs();
  const startTime = Date.now();

  console.log('=== PAF Data Export to NDJSON ===\n');
  console.log(`Database: ${CONFIG.dbPath}`);
  console.log(`Output directory: ${args.outputDir}`);
  console.log(`Records per file: ${args.recordsPerFile.toLocaleString()}`);
  console.log(`Upload to S3: ${args.uploadS3}`);
  if (args.uploadS3) {
    console.log(`S3 bucket: ${CONFIG.s3Bucket}`);
    console.log(`S3 prefix: ${args.s3Prefix}`);
  }
  console.log('');

  // Create output directory
  if (!fs.existsSync(args.outputDir)) {
    fs.mkdirSync(args.outputDir, { recursive: true });
  }

  // Open database
  console.log('Opening database...');
  const db = new Database(CONFIG.dbPath, { readonly: true });

  // Get total count
  const countResult = db.prepare('SELECT COUNT(*) as total FROM DELIVERY_POINT').get() as { total: number };
  const totalRecords = countResult.total;
  console.log(`Total records: ${totalRecords.toLocaleString()}`);

  // Prepare batch query
  const batchStmt = db.prepare(BATCH_QUERY);
  const batchSize = 10000; // Read batch size (internal)

  let processedRecords = 0;
  let currentFileRecords = 0;
  let fileNumber = 0;
  let currentFileStream: fs.WriteStream | null = null;
  let currentFilePath = '';

  const exportedFiles: string[] = [];

  console.log('\nStarting export...\n');

  while (processedRecords < totalRecords) {
    // Start new file if needed
    if (currentFileRecords === 0 || currentFileRecords >= args.recordsPerFile) {
      // Close previous file
      if (currentFileStream) {
        currentFileStream.end();
        exportedFiles.push(currentFilePath);
        console.log(`  Completed: ${path.basename(currentFilePath)} (${currentFileRecords.toLocaleString()} records)`);
      }

      // Start new file
      fileNumber++;
      currentFilePath = path.join(args.outputDir, `paf-addresses-${String(fileNumber).padStart(4, '0')}.ndjson`);
      currentFileStream = fs.createWriteStream(currentFilePath);
      currentFileRecords = 0;

      console.log(`  Writing: ${path.basename(currentFilePath)}...`);
    }

    // Read batch
    const rows = batchStmt.all(batchSize, processedRecords) as SqliteRow[];
    if (rows.length === 0) break;

    // Transform and write
    for (const row of rows) {
      const doc = transformToDocument(row);

      // Write bulk API format: action line + document line
      const actionLine = JSON.stringify({ index: { _index: CONFIG.indexName, _id: doc.delivery_point_id.toString() } });
      const docLine = JSON.stringify(doc);

      currentFileStream!.write(actionLine + '\n');
      currentFileStream!.write(docLine + '\n');

      currentFileRecords++;
      processedRecords++;

      // Check if we need to start a new file
      if (currentFileRecords >= args.recordsPerFile) {
        break;
      }
    }

    // Progress update
    const progressPercent = ((processedRecords / totalRecords) * 100).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = Math.round(processedRecords / elapsed);
    const remaining = Math.round((totalRecords - processedRecords) / rate);

    process.stdout.write(`\r  Progress: ${processedRecords.toLocaleString()}/${totalRecords.toLocaleString()} (${progressPercent}%) - ${rate.toLocaleString()} rec/s - ETA: ${Math.floor(remaining / 60)}m ${remaining % 60}s   `);
  }

  // Close last file
  if (currentFileStream) {
    currentFileStream.end();
    exportedFiles.push(currentFilePath);
    console.log(`\n  Completed: ${path.basename(currentFilePath)} (${currentFileRecords.toLocaleString()} records)`);
  }

  db.close();

  const totalDuration = (Date.now() - startTime) / 1000;
  console.log('\n=== Export Complete ===');
  console.log(`Total records: ${processedRecords.toLocaleString()}`);
  console.log(`Total files: ${exportedFiles.length}`);
  console.log(`Duration: ${Math.floor(totalDuration / 60)}m ${Math.round(totalDuration % 60)}s`);
  console.log(`Rate: ${Math.round(processedRecords / totalDuration).toLocaleString()} records/second`);

  // Upload to S3 if requested
  if (args.uploadS3) {
    console.log('\n=== Uploading to S3 ===');
    for (const filePath of exportedFiles) {
      const fileName = path.basename(filePath);
      const s3Key = args.s3Prefix + fileName;
      console.log(`  Uploading: ${fileName} -> s3://${CONFIG.s3Bucket}/${s3Key}`);
      await uploadToS3(filePath, s3Key);
    }
    console.log('Upload complete!');
  }

  console.log('\n=== Next Steps ===');
  console.log('1. Upload files to S3 (if not already done):');
  console.log(`   aws s3 sync ${args.outputDir} s3://${CONFIG.s3Bucket}/${args.s3Prefix}`);
  console.log('\n2. Use OpenSearch _bulk API to load:');
  console.log('   for file in export/*.ndjson; do');
  console.log('     curl -X POST "https://your-opensearch-endpoint/_bulk" \\');
  console.log('       -H "Content-Type: application/x-ndjson" \\');
  console.log('       --data-binary "@$file"');
  console.log('   done');
  console.log('\n3. Or use OpenSearch Ingestion pipeline for automated loading');
}

main().catch(error => {
  console.error('Export failed:', error);
  process.exit(1);
});
