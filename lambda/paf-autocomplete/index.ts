import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * PAF (Postcode Address File) Autocomplete Lambda Handler
 *
 * This is a placeholder implementation for the PAF autocomplete service.
 * Future implementation will integrate with PAF data provider.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('PAF Autocomplete - Event received:', JSON.stringify(event, null, 2));

  try {
    const query = event.queryStringParameters?.query || '';
    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);

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

    console.log(`PAF Autocomplete query: "${query}", limit: ${limit}`);

    // Placeholder response - will be replaced with actual PAF integration
    const mockResults = [
      {
        id: '1',
        address: `${query} Street, Sydney NSW 2000`,
        formattedAddress: `${query} Street, Sydney, New South Wales, 2000`,
        postcode: '2000',
        state: 'NSW',
        suburb: 'Sydney',
        confidence: 0.95,
      },
      {
        id: '2',
        address: `${query} Avenue, Melbourne VIC 3000`,
        formattedAddress: `${query} Avenue, Melbourne, Victoria, 3000`,
        postcode: '3000',
        state: 'VIC',
        suburb: 'Melbourne',
        confidence: 0.87,
      },
    ].slice(0, limit);

    console.log(`PAF Autocomplete returning ${mockResults.length} results`);

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
        source: 'PAF',
      }),
    };
  } catch (error) {
    console.error('PAF Autocomplete error:', error);

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
