#!/usr/bin/env npx ts-node

/**
 * Bulk load NDJSON files to OpenSearch using _bulk API
 *
 * This script loads pre-exported NDJSON files to OpenSearch in parallel
 * for maximum throughput.
 *
 * Usage:
 *   npx ts-node scripts/bulk-load-ndjson.ts [options]
 *
 * Options:
 *   --input-dir <dir>      Directory containing NDJSON files (default: ./export)
 *   --parallel <n>         Number of parallel uploads (default: 3)
 *   --from-s3              Load files from S3 instead of local
 *   --s3-prefix <prefix>   S3 prefix (default: paf-export/)
 */

import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const AWS_PROFILE = 'fbdms';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG = {
  opensearchEndpoint: 'https://xxc3y25wjttu3kt8pv71.ap-southeast-2.aoss.amazonaws.com',
  opensearchIndex: 'paf-addresses',
  region: 'ap-southeast-2',
  s3Bucket: 'rapid-address-dev-data',
  defaultInputDir: path.join(__dirname, '..', 'export'),
  defaultParallel: 3,
  defaultS3Prefix: 'paf-export/',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    inputDir: CONFIG.defaultInputDir,
    parallel: CONFIG.defaultParallel,
    fromS3: false,
    s3Prefix: CONFIG.defaultS3Prefix,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input-dir' && args[i + 1]) {
      result.inputDir = args[i + 1];
      i++;
    } else if (args[i] === '--parallel' && args[i + 1]) {
      result.parallel = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--from-s3') {
      result.fromS3 = true;
    } else if (args[i] === '--s3-prefix' && args[i + 1]) {
      result.s3Prefix = args[i + 1];
      i++;
    }
  }

  return result;
}

async function getLocalFiles(inputDir: string): Promise<string[]> {
  const files = fs.readdirSync(inputDir)
    .filter(f => f.endsWith('.ndjson'))
    .sort()
    .map(f => path.join(inputDir, f));
  return files;
}

async function getS3Files(s3Prefix: string): Promise<string[]> {
  const s3Client = new S3Client({ region: CONFIG.region, credentials: fromIni({ profile: AWS_PROFILE }) });
  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: CONFIG.s3Bucket,
    Prefix: s3Prefix,
  }));

  return (response.Contents || [])
    .filter(obj => obj.Key?.endsWith('.ndjson'))
    .map(obj => obj.Key!)
    .sort();
}

async function* readLocalFileChunks(filePath: string, linesPerChunk: number): AsyncGenerator<string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Lines come in pairs: action line + doc line
  for (let i = 0; i < lines.length; i += linesPerChunk * 2) {
    const chunkLines = lines.slice(i, i + linesPerChunk * 2);
    yield chunkLines.join('\n') + '\n';
  }
}

async function readS3File(s3Key: string): Promise<string> {
  const s3Client = new S3Client({ region: CONFIG.region, credentials: fromIni({ profile: AWS_PROFILE }) });
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: CONFIG.s3Bucket,
    Key: s3Key,
  }));

  return await response.Body!.transformToString();
}

async function bulkLoad(
  client: Client,
  content: string,
  fileName: string
): Promise<{ success: number; failed: number; duration: number }> {
  const startTime = Date.now();

  try {
    // The content is already in bulk API format (action + doc pairs)
    const response = await client.bulk({
      body: content as any,
      refresh: false,
    });

    const duration = Date.now() - startTime;
    const items = response.body.items || [];
    const failed = items.filter((item: any) => item.index?.error).length;
    const success = items.length - failed;

    if (failed > 0) {
      console.log(`  ${fileName}: ${success.toLocaleString()} success, ${failed} failed (${(duration / 1000).toFixed(1)}s)`);
    } else {
      console.log(`  ${fileName}: ${success.toLocaleString()} records (${(duration / 1000).toFixed(1)}s)`);
    }

    return { success, failed, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`  ${fileName}: ERROR - ${error.message}`);
    return { success: 0, failed: 0, duration };
  }
}

const RECORDS_PER_CHUNK = 5000; // 5000 records per bulk request

async function processFile(
  client: Client,
  fileSource: string,
  fromS3: boolean
): Promise<{ success: number; failed: number; duration: number }> {
  const fileName = path.basename(fileSource);
  const startTime = Date.now();
  let totalSuccess = 0;
  let totalFailed = 0;
  let chunkNum = 0;

  if (fromS3) {
    // For S3, still read full file (could be improved)
    const content = await readS3File(fileSource);
    const result = await bulkLoad(client, content, fileName);
    return result;
  }

  // For local files, process in chunks
  for await (const chunk of readLocalFileChunks(fileSource, RECORDS_PER_CHUNK)) {
    chunkNum++;
    const result = await bulkLoad(client, chunk, `${fileName}[${chunkNum}]`);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  const duration = Date.now() - startTime;
  console.log(`  ${fileName}: TOTAL ${totalSuccess.toLocaleString()} success (${(duration / 1000).toFixed(1)}s)`);
  return { success: totalSuccess, failed: totalFailed, duration };
}

async function main() {
  const args = parseArgs();
  const startTime = Date.now();

  console.log('=== PAF Bulk Load to OpenSearch ===\n');
  console.log(`OpenSearch: ${CONFIG.opensearchEndpoint}`);
  console.log(`Index: ${CONFIG.opensearchIndex}`);
  console.log(`Parallel workers: ${args.parallel}`);
  console.log(`Source: ${args.fromS3 ? `s3://${CONFIG.s3Bucket}/${args.s3Prefix}` : args.inputDir}`);
  console.log('');

  // Initialize OpenSearch client with fbdms profile
  const credentialsProvider = fromIni({ profile: AWS_PROFILE });
  const client = new Client({
    ...AwsSigv4Signer({
      region: CONFIG.region,
      service: 'aoss',
      getCredentials: () => credentialsProvider(),
    }),
    node: CONFIG.opensearchEndpoint,
    requestTimeout: 300000, // 5 minutes per request
  });

  // Get initial count
  let initialCount = 0;
  try {
    const countResponse = await client.count({ index: CONFIG.opensearchIndex });
    initialCount = countResponse.body.count;
    console.log(`Current index count: ${initialCount.toLocaleString()}`);
  } catch (error) {
    console.log('Index appears empty or does not exist');
  }

  // Get list of files
  console.log('\nDiscovering files...');
  const files = args.fromS3
    ? await getS3Files(args.s3Prefix)
    : await getLocalFiles(args.inputDir);

  console.log(`Found ${files.length} NDJSON files\n`);

  if (files.length === 0) {
    console.log('No files to process. Run export-to-ndjson.ts first.');
    return;
  }

  // Process files in parallel batches
  console.log('Loading files...');
  let totalSuccess = 0;
  let totalFailed = 0;

  // Create work queue
  const queue = [...files];
  const workers: Promise<void>[] = [];

  const processQueue = async () => {
    while (queue.length > 0) {
      const file = queue.shift()!;
      const result = await processFile(client, file, args.fromS3);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }
  };

  // Start parallel workers
  for (let i = 0; i < args.parallel; i++) {
    workers.push(processQueue());
  }

  // Wait for all workers
  await Promise.all(workers);

  // Get final count
  const totalDuration = (Date.now() - startTime) / 1000;
  let finalCount = 0;
  try {
    // Wait a moment for indexing to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    const countResponse = await client.count({ index: CONFIG.opensearchIndex });
    finalCount = countResponse.body.count;
  } catch (error) {
    console.log('Could not get final count');
  }

  console.log('\n=== Bulk Load Complete ===');
  console.log(`Total records loaded: ${totalSuccess.toLocaleString()}`);
  console.log(`Total failed: ${totalFailed.toLocaleString()}`);
  console.log(`Duration: ${Math.floor(totalDuration / 60)}m ${Math.round(totalDuration % 60)}s`);
  console.log(`Rate: ${Math.round(totalSuccess / totalDuration).toLocaleString()} records/second`);
  console.log(`Index count: ${initialCount.toLocaleString()} -> ${finalCount.toLocaleString()}`);
}

main().catch(error => {
  console.error('Bulk load failed:', error);
  process.exit(1);
});
