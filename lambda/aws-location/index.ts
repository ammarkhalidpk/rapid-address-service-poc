import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * AWS Location Service Autocomplete Lambda Handler
 *
 * This is a placeholder implementation for AWS Location Service integration.
 * Future implementation will use AWS Location Service SearchPlaceIndexForSuggestions API.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('AWS Location - Event received:', JSON.stringify(event, null, 2));

  try {
    const query = event.queryStringParameters?.query || '';
    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);
    const biasPosition = event.queryStringParameters?.biasPosition; // Format: "lng,lat"

    if (!query || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Missing required query parameter: query',
        }),
      };
    }

    console.log(`AWS Location query: "${query}", limit: ${limit}, bias: ${biasPosition || 'none'}`);

    // Placeholder response - will be replaced with actual AWS Location Service integration
    const mockResults = [
      {
        id: 'place-1',
        text: `${query} Street`,
        placeName: `${query} Street, Sydney, New South Wales, 2000, Australia`,
        region: 'New South Wales',
        municipality: 'Sydney',
        postalCode: '2000',
        country: 'AUS',
        geometry: {
          point: [151.2093, -33.8688], // lng, lat
        },
        relevance: 0.92,
      },
      {
        id: 'place-2',
        text: `${query} Avenue`,
        placeName: `${query} Avenue, Melbourne, Victoria, 3000, Australia`,
        region: 'Victoria',
        municipality: 'Melbourne',
        postalCode: '3000',
        country: 'AUS',
        geometry: {
          point: [144.9631, -37.8136], // lng, lat
        },
        relevance: 0.85,
      },
    ].slice(0, limit);

    console.log(`AWS Location returning ${mockResults.length} results`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        query,
        results: mockResults,
        count: mockResults.length,
        source: 'AWSLocation',
        biasPosition: biasPosition || null,
      }),
    };
  } catch (error) {
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
      }),
    };
  }
};
