#!/usr/bin/env npx ts-node

/**
 * Script to delete and recreate the OpenSearch index
 *
 * Usage:
 *   npx ts-node scripts/recreate-index.ts
 */

import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { fromIni } from '@aws-sdk/credential-provider-ini';

const AWS_PROFILE = 'fbdms';

const CONFIG = {
  opensearchEndpoint: 'https://xxc3y25wjttu3kt8pv71.ap-southeast-2.aoss.amazonaws.com',
  opensearchIndex: 'paf-addresses',
  region: 'ap-southeast-2',
};

async function recreateIndex() {
  console.log('=== Recreate OpenSearch Index ===\n');

  // Initialize client with fbdms profile
  const credentialsProvider = fromIni({ profile: AWS_PROFILE });
  const client = new Client({
    ...AwsSigv4Signer({
      region: CONFIG.region,
      service: 'aoss',
      getCredentials: () => credentialsProvider(),
    }),
    node: CONFIG.opensearchEndpoint,
  });

  // Check if index exists
  console.log(`Checking if index "${CONFIG.opensearchIndex}" exists...`);
  let indexExists = false;
  try {
    const countResponse = await client.count({ index: CONFIG.opensearchIndex });
    indexExists = true;
    console.log(`Index exists with ${countResponse.body.count} documents.`);
  } catch (error: any) {
    if (error?.meta?.statusCode === 404) {
      console.log('Index does not exist.');
    } else {
      throw error;
    }
  }

  // Delete index if exists
  if (indexExists) {
    console.log(`\nDeleting index "${CONFIG.opensearchIndex}"...`);
    try {
      await client.indices.delete({ index: CONFIG.opensearchIndex });
      console.log('Index deleted successfully.');
    } catch (error: any) {
      console.error('Failed to delete index:', error.message);
      throw error;
    }
  }

  // Wait a bit for deletion to propagate
  console.log('\nWaiting for deletion to propagate...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Create index directly with mappings
  console.log(`\nCreating index "${CONFIG.opensearchIndex}" with PAF mappings...`);

  const mappings = {
    settings: {
      index: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      analysis: {
        analyzer: {
          autocomplete_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'edge_ngram_filter'],
          },
          autocomplete_search_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase'],
          },
        },
        filter: {
          edge_ngram_filter: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 20,
          },
        },
      },
    },
    mappings: {
      properties: {
        delivery_point_id: { type: 'long' },
        delivery_point_group_id: { type: 'long' },
        unit: {
          type: 'object',
          properties: {
            type: { type: 'keyword' },
            number: { type: 'keyword' },
            full: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          },
        },
        floor: {
          type: 'object',
          properties: {
            type: { type: 'keyword' },
            number: { type: 'keyword' },
            full: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          },
        },
        building_name: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        street_number: {
          type: 'object',
          properties: {
            first: { type: 'integer' },
            first_suffix: { type: 'keyword' },
            last: { type: 'integer' },
            last_suffix: { type: 'keyword' },
            full: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          },
        },
        lot_number: { type: 'keyword' },
        postal_delivery: {
          type: 'object',
          properties: {
            type: { type: 'keyword' },
            number: { type: 'integer' },
            prefix: { type: 'keyword' },
            suffix: { type: 'keyword' },
            full: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          },
        },
        street: {
          type: 'object',
          properties: {
            name: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
                autocomplete: {
                  type: 'text',
                  analyzer: 'autocomplete_analyzer',
                  search_analyzer: 'autocomplete_search_analyzer',
                },
              },
            },
            type: { type: 'keyword' },
            suffix: { type: 'keyword' },
            full: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
                autocomplete: {
                  type: 'text',
                  analyzer: 'autocomplete_analyzer',
                  search_analyzer: 'autocomplete_search_analyzer',
                },
              },
            },
          },
        },
        locality: {
          type: 'object',
          properties: {
            id: { type: 'long' },
            name: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
                autocomplete: {
                  type: 'text',
                  analyzer: 'autocomplete_analyzer',
                  search_analyzer: 'autocomplete_search_analyzer',
                },
              },
            },
            postcode: { type: 'keyword', fields: { text: { type: 'text' } } },
            state: { type: 'keyword' },
          },
        },
        primary_point: { type: 'boolean' },
        formatted_address: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
        formatted_address_short: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },
        search_text: {
          type: 'text',
          fields: {
            autocomplete: {
              type: 'text',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'autocomplete_search_analyzer',
            },
          },
        },
      },
    },
  };

  const createResponse = await client.indices.create({
    index: CONFIG.opensearchIndex,
    body: mappings as any,
  });

  console.log('Index created successfully:', JSON.stringify(createResponse.body, null, 2));

  // Verify index was created
  console.log(`\nVerifying index "${CONFIG.opensearchIndex}" was created...`);
  try {
    const countResponse = await client.count({ index: CONFIG.opensearchIndex });
    console.log(`Index exists with ${countResponse.body.count} documents.`);
    console.log('\n✓ Index recreated successfully!');
  } catch (error: any) {
    console.error('Index verification failed:', error.message);
    throw error;
  }
}

recreateIndex().catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
