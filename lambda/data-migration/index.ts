/**
 * Data Migration Lambda Handler
 *
 * Migrates 15.7M PAF addresses from SQLite database to OpenSearch Serverless
 * - Downloads SQLite database from S3 to /tmp
 * - Reads database in batches (10K records)
 * - Transforms records to OpenSearch document format
 * - Bulk indexes documents to OpenSearch
 * - Logs progress to CloudWatch
 *
 * Configuration:
 * - Memory: 1024 MB
 * - Timeout: 900s (15 minutes)
 * - Ephemeral Storage: 10GB
 */

import { Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseReader } from './database';
import { OpenSearchIndexer } from './opensearch';
import { transformToDocument } from './transformer';
import {
  MigrationEvent,
  MigrationResponse,
  MigrationProgress,
  BatchResult,
} from './types';

const DEFAULT_BATCH_SIZE = 10000;

/**
 * Main Lambda handler
 */
export const handler: Handler<MigrationEvent, MigrationResponse> = async (event) => {
  const startTime = Date.now();
  console.log('Data Migration Lambda started', { event });

  // Validate required environment variables
  const opensearchEndpoint = process.env.OPENSEARCH_ENDPOINT;
  const opensearchIndex = process.env.OPENSEARCH_INDEX || 'paf-addresses';
  const region = process.env.AWS_REGION || 'ap-southeast-2';

  if (!opensearchEndpoint) {
    throw new Error('OPENSEARCH_ENDPOINT environment variable is required');
  }

  // Extract event parameters
  const s3Bucket = event.s3Bucket;
  const s3Key = event.s3Key;
  const batchSize = event.batchSize || DEFAULT_BATCH_SIZE;
  const startOffset = event.startOffset || 0;
  const maxRecords = event.maxRecords;

  console.log('Migration configuration', {
    s3Bucket,
    s3Key,
    batchSize,
    startOffset,
    maxRecords,
    opensearchEndpoint,
    opensearchIndex,
    region,
  });

  // Initialize progress tracking
  const progress: MigrationProgress = {
    totalRecords: 0,
    processedRecords: 0,
    indexedRecords: 0,
    failedRecords: 0,
    batchNumber: 0,
    startTime,
    lastBatchTime: startTime,
  };

  const batches: BatchResult[] = [];
  let dbReader: DatabaseReader | null = null;

  try {
    // Step 1: Download SQLite database from S3 to /tmp
    const dbPath = await downloadDatabaseFromS3(s3Bucket, s3Key);
    console.log(`Database downloaded to: ${dbPath}`);

    // Step 2: Initialize database reader
    dbReader = new DatabaseReader(dbPath);
    await dbReader.initialize();
    progress.totalRecords = dbReader.getTotalCount();

    // Apply max records limit if specified
    const recordsToProcess = maxRecords
      ? Math.min(maxRecords, progress.totalRecords - startOffset)
      : progress.totalRecords - startOffset;

    console.log(`Processing ${recordsToProcess} records starting at offset ${startOffset}`);

    // Step 3: Initialize OpenSearch indexer
    const indexer = new OpenSearchIndexer(opensearchEndpoint, opensearchIndex, region);

    // Skip index existence check - assume init Lambda has already created the index
    // This avoids permission issues with indices.exists API on OpenSearch Serverless
    console.log(`Assuming index "${opensearchIndex}" exists (pre-created by init Lambda)`);
    console.log('If indexing fails with "index not found", run the init Lambda first.');

    // Step 4: Process records in batches
    let currentOffset = startOffset;
    let remainingRecords = recordsToProcess;

    while (remainingRecords > 0) {
      const batchStartTime = Date.now();
      progress.batchNumber++;

      const currentBatchSize = Math.min(batchSize, remainingRecords);
      console.log(
        `\n=== Batch ${progress.batchNumber}: Processing ${currentBatchSize} records at offset ${currentOffset} ===`
      );

      try {
        // Read batch from database
        const rows = dbReader.readBatch(currentBatchSize, currentOffset);

        if (rows.length === 0) {
          console.log('No more records to process');
          break;
        }

        // Transform rows to OpenSearch documents
        const documents = rows.map(transformToDocument);
        console.log(`Transformed ${documents.length} records to OpenSearch documents`);

        // Bulk index documents with retry
        const indexedCount = await indexer.bulkIndexWithRetry(documents, 3, 1000);

        // Update progress
        progress.processedRecords += rows.length;
        progress.indexedRecords += indexedCount;
        progress.failedRecords += rows.length - indexedCount;
        progress.lastBatchTime = Date.now();

        // Record batch result
        const batchDuration = Date.now() - batchStartTime;
        batches.push({
          batchNumber: progress.batchNumber,
          recordsProcessed: rows.length,
          recordsIndexed: indexedCount,
          recordsFailed: rows.length - indexedCount,
          durationMs: batchDuration,
        });

        // Log progress
        const progressPercent = ((progress.processedRecords / recordsToProcess) * 100).toFixed(2);
        const avgBatchTime = (Date.now() - startTime) / progress.batchNumber;
        const remainingBatches = Math.ceil(remainingRecords / batchSize);
        const estimatedTimeRemaining = (remainingBatches * avgBatchTime) / 1000 / 60;

        console.log(`Batch ${progress.batchNumber} completed in ${batchDuration}ms`);
        console.log(
          `Progress: ${progress.processedRecords}/${recordsToProcess} (${progressPercent}%)`
        );
        console.log(`Indexed: ${progress.indexedRecords}, Failed: ${progress.failedRecords}`);
        console.log(
          `Estimated time remaining: ${estimatedTimeRemaining.toFixed(1)} minutes`
        );

        // Move to next batch
        currentOffset += currentBatchSize;
        remainingRecords -= rows.length;
      } catch (error) {
        console.error(`Batch ${progress.batchNumber} failed:`, error);
        // Record failed batch
        batches.push({
          batchNumber: progress.batchNumber,
          recordsProcessed: 0,
          recordsIndexed: 0,
          recordsFailed: currentBatchSize,
          durationMs: Date.now() - batchStartTime,
        });
        progress.failedRecords += currentBatchSize;

        // Continue to next batch instead of failing entire migration
        currentOffset += currentBatchSize;
        remainingRecords -= currentBatchSize;
      }
    }

    // Step 5: Final index refresh
    console.log('\nRefreshing index to make documents searchable...');
    await indexer.refresh();

    // Get final document count
    const finalCount = await indexer.getDocumentCount();
    console.log(`Final document count in index: ${finalCount}`);

    // Calculate final statistics
    const totalDuration = Date.now() - startTime;
    const avgRecordsPerSecond = Math.round(
      (progress.processedRecords / totalDuration) * 1000
    );

    console.log('\n=== Migration Completed ===');
    console.log(`Total duration: ${(totalDuration / 1000 / 60).toFixed(2)} minutes`);
    console.log(`Total records processed: ${progress.processedRecords}`);
    console.log(`Total records indexed: ${progress.indexedRecords}`);
    console.log(`Total records failed: ${progress.failedRecords}`);
    console.log(`Average throughput: ${avgRecordsPerSecond} records/second`);
    console.log(`Batches processed: ${progress.batchNumber}`);

    return {
      success: true,
      message: 'Migration completed successfully',
      totalRecords: progress.totalRecords,
      processedRecords: progress.processedRecords,
      indexedRecords: progress.indexedRecords,
      failedRecords: progress.failedRecords,
      batches,
      durationMs: totalDuration,
    };
  } catch (error) {
    console.error('Migration failed:', error);

    const totalDuration = Date.now() - startTime;

    return {
      success: false,
      message: 'Migration failed',
      totalRecords: progress.totalRecords,
      processedRecords: progress.processedRecords,
      indexedRecords: progress.indexedRecords,
      failedRecords: progress.failedRecords,
      batches,
      durationMs: totalDuration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Cleanup: Close database connection
    if (dbReader) {
      dbReader.close();
    }
  }
};

/**
 * Download SQLite database from S3 to /tmp
 *
 * @param bucket S3 bucket name
 * @param key S3 object key
 * @returns Path to downloaded database file
 */
async function downloadDatabaseFromS3(bucket: string, key: string): Promise<string> {
  console.log(`Downloading database from s3://${bucket}/${key}...`);

  const s3Client = new S3Client({});
  const dbPath = path.join('/tmp', 'paf.db');

  try {
    // Get object from S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('S3 object body is empty');
    }

    // Stream to file
    const writeStream = fs.createWriteStream(dbPath);
    const readableStream = response.Body as NodeJS.ReadableStream;

    await new Promise<void>((resolve, reject) => {
      readableStream.pipe(writeStream);
      readableStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });

    // Get file size
    const stats = fs.statSync(dbPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Database downloaded successfully: ${fileSizeMB} MB`);

    return dbPath;
  } catch (error) {
    console.error('Failed to download database from S3:', error);
    throw new Error(
      `Failed to download database from S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
