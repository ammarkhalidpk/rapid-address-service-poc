/**
 * OpenSearch Indexer Module
 *
 * Handles bulk indexing of documents to OpenSearch Serverless
 * Includes retry logic and AWS Sigv4 authentication
 */

import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { OpenSearchDocument } from './types';

/**
 * OpenSearch indexer class
 * Provides bulk indexing capabilities with retry logic
 */
export class OpenSearchIndexer {
  private client: Client;
  private indexName: string;

  constructor(endpoint: string, indexName: string, region: string) {
    this.indexName = indexName;

    // Create OpenSearch client with AWS Sigv4 authentication
    this.client = new Client({
      ...AwsSigv4Signer({
        region: region,
        service: 'aoss',
        getCredentials: () => {
          const credentialsProvider = defaultProvider();
          return credentialsProvider();
        },
      }),
      node: endpoint,
    });

    console.log(`OpenSearch client initialized: ${endpoint}, index: ${indexName}`);
  }

  /**
   * Bulk index documents to OpenSearch
   *
   * @param documents Array of OpenSearch documents
   * @returns Number of successfully indexed documents
   */
  async bulkIndex(documents: OpenSearchDocument[]): Promise<number> {
    if (documents.length === 0) {
      console.log('No documents to index');
      return 0;
    }

    try {
      // Build bulk request body
      const bulkBody = documents.flatMap((doc) => [
        { index: { _index: this.indexName, _id: doc.delivery_point_id.toString() } },
        doc,
      ]);

      console.log(`Indexing ${documents.length} documents to ${this.indexName}...`);
      const startTime = Date.now();

      // Execute bulk request
      const response = await this.client.bulk({
        body: bulkBody,
        refresh: false, // Don't force immediate refresh for better performance
      });

      const duration = Date.now() - startTime;

      // Check for errors in the response
      if (response.body.errors) {
        const errorCount = response.body.items.filter(
          (item: any) => item.index?.error
        ).length;
        console.error(`Bulk indexing completed with ${errorCount} errors (${duration}ms)`);

        // Log first few errors for debugging
        const errors = response.body.items
          .filter((item: any) => item.index?.error)
          .slice(0, 5);
        console.error('Sample errors:', JSON.stringify(errors, null, 2));

        const successCount = documents.length - errorCount;
        console.log(`Successfully indexed ${successCount}/${documents.length} documents`);
        return successCount;
      }

      console.log(`Successfully indexed ${documents.length} documents (${duration}ms)`);
      return documents.length;
    } catch (error) {
      console.error('Bulk indexing failed:', error);
      throw new Error(
        `Bulk indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Bulk index with retry logic
   *
   * @param documents Array of OpenSearch documents
   * @param maxRetries Maximum number of retry attempts
   * @param retryDelayMs Delay between retries in milliseconds
   * @returns Number of successfully indexed documents
   */
  async bulkIndexWithRetry(
    documents: OpenSearchDocument[],
    maxRetries: number = 3,
    retryDelayMs: number = 1000
  ): Promise<number> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.bulkIndex(documents);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Bulk indexing attempt ${attempt}/${maxRetries} failed:`, lastError.message);

        if (attempt < maxRetries) {
          const delay = retryDelayMs * attempt; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    throw new Error(
      `Bulk indexing failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Check if index exists
   */
  async indexExists(): Promise<boolean> {
    try {
      const response = await this.client.indices.exists({ index: this.indexName });
      return response.body === true;
    } catch (error) {
      console.error('Error checking index existence:', error);
      return false;
    }
  }

  /**
   * Get index document count
   */
  async getDocumentCount(): Promise<number> {
    try {
      const response = await this.client.count({ index: this.indexName });
      return response.body.count;
    } catch (error) {
      console.error('Error getting document count:', error);
      return 0;
    }
  }

  /**
   * Refresh index to make documents searchable
   */
  async refresh(): Promise<void> {
    try {
      await this.client.indices.refresh({ index: this.indexName });
      console.log(`Index ${this.indexName} refreshed`);
    } catch (error) {
      console.error('Error refreshing index:', error);
      // Don't throw - refresh is not critical
    }
  }
}

/**
 * Helper function to sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
