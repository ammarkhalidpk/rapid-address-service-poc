import { Handler } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

/**
 * OpenSearch Index Initialization Lambda Handler
 *
 * Creates the paf-addresses index with proper mappings and analyzers
 * for PAF address autocomplete. This is a one-time initialization function.
 */

interface IndexMappings {
  settings: {
    index: {
      number_of_shards: number;
      number_of_replicas: number;
    };
    analysis: {
      analyzer: {
        autocomplete_analyzer: {
          type: string;
          tokenizer: string;
          filter: string[];
        };
        autocomplete_search_analyzer: {
          type: string;
          tokenizer: string;
          filter: string[];
        };
      };
      filter: {
        edge_ngram_filter: {
          type: string;
          min_gram: number;
          max_gram: number;
        };
      };
    };
  };
  mappings: {
    properties: {
      [key: string]: any;
    };
  };
}

const getIndexMappings = (): IndexMappings => ({
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
      udprn: { type: 'keyword' },
      uprn: { type: 'keyword' },
      postcode: { type: 'keyword' },
      post_town: { type: 'keyword' },
      building_number: { type: 'keyword' },
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
      sub_building: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      street_name: {
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
      locality: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      organisation_name: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      formatted_address: {
        type: 'text',
        fields: {
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete_analyzer',
            search_analyzer: 'autocomplete_search_analyzer',
          },
        },
      },
      created_at: { type: 'date' },
    },
  },
});

export const handler: Handler = async (event) => {
  const endpoint = process.env.OPENSEARCH_ENDPOINT;
  const indexName = process.env.OPENSEARCH_INDEX || 'paf-addresses';
  const environment = process.env.ENVIRONMENT || 'dev';

  console.log('OpenSearch Init - Starting index initialization', {
    endpoint,
    indexName,
    environment,
  });

  if (!endpoint) {
    const error = 'OPENSEARCH_ENDPOINT environment variable is required';
    console.error(error);
    throw new Error(error);
  }

  try {
    // Create OpenSearch client with AWS Sigv4 authentication
    const client = new Client({
      ...AwsSigv4Signer({
        region: process.env.AWS_REGION || 'ap-southeast-2',
        service: 'aoss',
        getCredentials: () => {
          const credentialsProvider = defaultProvider();
          return credentialsProvider();
        },
      }),
      node: endpoint,
    });

    // Check if index already exists
    console.log(`Checking if index "${indexName}" exists...`);
    const indexExists = await client.indices.exists({ index: indexName });

    if (indexExists.body) {
      console.log(`Index "${indexName}" already exists. Skipping creation.`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Index already exists',
          indexName,
          action: 'skipped',
        }),
      };
    }

    // Create index with mappings
    console.log(`Creating index "${indexName}" with PAF mappings...`);
    const mappings = getIndexMappings();

    const createResponse = await client.indices.create({
      index: indexName,
      body: mappings,
    });

    console.log('Index created successfully:', JSON.stringify(createResponse.body, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Index created successfully',
        indexName,
        action: 'created',
        response: createResponse.body,
      }),
    };
  } catch (error) {
    console.error('Error initializing OpenSearch index:', error);

    // Return error details
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to initialize OpenSearch index',
        message: error instanceof Error ? error.message : 'Unknown error',
        indexName,
      }),
    };
  }
};
