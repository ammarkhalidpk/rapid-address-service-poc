import { Handler } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

/**
 * OpenSearch Index Initialization Lambda Handler
 *
 * Creates the paf-addresses index with proper mappings and analyzers
 * for PAF address autocomplete. This is a one-time initialization function.
 *
 * Index mappings match the PAF address document structure from the migration:
 * - delivery_point_id: Unique identifier
 * - unit, floor, street, street_number, postal_delivery: Nested objects
 * - locality: Object with id, name, postcode, state
 * - formatted_address, search_text: Text fields for autocomplete
 */

const getIndexMappings = () => ({
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
      // Primary identifiers
      delivery_point_id: { type: 'long' },
      delivery_point_group_id: { type: 'long' },

      // Unit information (e.g., "U 505", "SHOP 45")
      unit: {
        type: 'object',
        properties: {
          type: { type: 'keyword' },
          number: { type: 'keyword' },
          full: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
        },
      },

      // Floor information (e.g., "L 2", "FLOOR 5")
      floor: {
        type: 'object',
        properties: {
          type: { type: 'keyword' },
          number: { type: 'keyword' },
          full: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
        },
      },

      // Building name (e.g., "TRINITY ARCADE")
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

      // Street number (e.g., "123", "1A", "80-100")
      street_number: {
        type: 'object',
        properties: {
          first: { type: 'integer' },
          first_suffix: { type: 'keyword' },
          last: { type: 'integer' },
          last_suffix: { type: 'keyword' },
          full: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
        },
      },

      // Lot number
      lot_number: { type: 'keyword' },

      // Postal delivery (e.g., "PO BOX 123")
      postal_delivery: {
        type: 'object',
        properties: {
          type: { type: 'keyword' },
          number: { type: 'integer' },
          prefix: { type: 'keyword' },
          suffix: { type: 'keyword' },
          full: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
        },
      },

      // Street information (e.g., "GEORGE", "ST", "NORTH")
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

      // Locality (suburb/city)
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
          postcode: {
            type: 'keyword',
            fields: {
              text: { type: 'text' },
            },
          },
          state: { type: 'keyword' },
        },
      },

      // Primary point indicator
      primary_point: { type: 'boolean' },

      // Full formatted addresses
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

      // Short formatted address (street + locality only)
      formatted_address_short: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },

      // Concatenated search text for multi-field matching
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
    let indexExists = false;
    try {
      const countResponse = await client.count({ index: indexName });
      indexExists = true;
      console.log(`Index "${indexName}" exists with ${countResponse.body.count} documents.`);
    } catch (error: any) {
      if (error?.meta?.statusCode === 404) {
        indexExists = false;
        console.log(`Index "${indexName}" does not exist.`);
      } else {
        throw error;
      }
    }

    if (indexExists) {
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
