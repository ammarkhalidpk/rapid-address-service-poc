import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  LocationClient,
  SearchPlaceIndexForSuggestionsCommand,
  SearchPlaceIndexForSuggestionsCommandInput,
} from '@aws-sdk/client-location';

/**
 * AWS Location Service Autocomplete Lambda Handler
 *
 * Integrates with AWS Location Service SearchPlaceIndexForSuggestions API
 * to provide address suggestions using Esri data provider.
 */

// Initialize Location Service client
const locationClient = new LocationClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('AWS Location - Event received:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  try {
    // Parse query parameter - support both 'q' and 'query'
    const query = event.queryStringParameters?.q || event.queryStringParameters?.query || '';

    if (!query || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required query parameter: q or query',
        }),
      };
    }

    // Validate Place Index environment variable
    const placeIndexName = process.env.PLACE_INDEX_NAME;
    if (!placeIndexName) {
      console.error('PLACE_INDEX_NAME environment variable is not set');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Configuration error: Place Index not configured',
        }),
      };
    }

    console.log(`AWS Location query: "${query}", placeIndex: ${placeIndexName}`);

    // Prepare SearchPlaceIndexForSuggestions request
    const input: SearchPlaceIndexForSuggestionsCommandInput = {
      IndexName: placeIndexName,
      Text: query,
      MaxResults: 5,
      FilterCountries: ['AUS'], // Filter to Australia only
    };

    // Call AWS Location Service
    const command = new SearchPlaceIndexForSuggestionsCommand(input);
    const response = await locationClient.send(command);

    const latencyMs = Date.now() - startTime;

    // Format results
    const results = (response.Results || []).map((result) => ({
      text: result.Text || '',
      placeId: result.PlaceId || '',
    }));

    console.log(`AWS Location returned ${results.length} results in ${latencyMs}ms`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        results,
        count: results.length,
        latencyMs,
        estimatedCost: 0.0005, // $0.0005 per request for SearchPlaceIndexForSuggestions
      }),
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('AWS Location error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs,
      }),
    };
  }
};
