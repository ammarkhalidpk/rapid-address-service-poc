import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT || '';
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || 'paf-addresses';
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client({
      ...AwsSigv4Signer({
        region: AWS_REGION,
        service: 'aoss',
        getCredentials: () => defaultProvider()(),
      }),
      node: OPENSEARCH_ENDPOINT,
      requestTimeout: 10000,
    });
  }
  return client;
}

interface AddressResult {
  delivery_point_id: number;
  formatted_address: string;
  formatted_address_short?: string;
  locality?: {
    name?: string;
    postcode?: string;
    state?: string;
  };
  street?: {
    name?: string;
    type?: string;
    full?: string;
  };
  street_number?: {
    full?: string;
  };
  unit?: {
    full?: string;
  };
  building_name?: string;
}

/**
 * PAF (Postcode Address File) Autocomplete Lambda Handler
 *
 * Queries OpenSearch Serverless for address autocomplete suggestions.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('PAF Autocomplete - Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const query = event.queryStringParameters?.query || '';
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '10', 10), 50);

    if (!query || query.trim().length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Query parameter must be at least 2 characters',
        }),
      };
    }

    console.log(`PAF Autocomplete query: "${query}", limit: ${limit}`);

    if (!OPENSEARCH_ENDPOINT) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'OpenSearch endpoint not configured',
        }),
      };
    }

    const opensearchClient = getClient();

    // Build the search query using multi_match with autocomplete fields
    const searchBody = {
      size: limit,
      query: {
        bool: {
          should: [
            // Primary: match on search_text autocomplete field
            {
              match: {
                'search_text.autocomplete': {
                  query: query,
                  boost: 3,
                },
              },
            },
            // Secondary: match on formatted_address autocomplete
            {
              match: {
                'formatted_address.autocomplete': {
                  query: query,
                  boost: 2,
                },
              },
            },
            // Tertiary: match on street name autocomplete
            {
              match: {
                'street.name.autocomplete': {
                  query: query,
                  boost: 1.5,
                },
              },
            },
            // Match on locality name
            {
              match: {
                'locality.name.autocomplete': {
                  query: query,
                  boost: 1,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      _source: [
        'delivery_point_id',
        'formatted_address',
        'formatted_address_short',
        'locality',
        'street',
        'street_number',
        'unit',
        'building_name',
      ],
    };

    const response = await opensearchClient.search({
      index: OPENSEARCH_INDEX,
      body: searchBody,
    });

    const hits = response.body.hits.hits || [];
    const results = hits.map((hit: { _source: AddressResult; _score: number }) => {
      const source = hit._source;
      return {
        id: source.delivery_point_id?.toString() || '',
        address: source.formatted_address || '',
        addressShort: source.formatted_address_short || source.formatted_address || '',
        suburb: source.locality?.name || '',
        postcode: source.locality?.postcode || '',
        state: source.locality?.state || '',
        street: source.street?.full || '',
        streetNumber: source.street_number?.full || '',
        unit: source.unit?.full || '',
        buildingName: source.building_name || '',
        score: hit._score,
      };
    });

    console.log(`PAF Autocomplete returning ${results.length} results`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        query,
        results,
        count: results.length,
        total: response.body.hits.total?.value || results.length,
        source: 'PAF',
      }),
    };
  } catch (error) {
    console.error('PAF Autocomplete error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
