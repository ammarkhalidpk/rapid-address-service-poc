import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';

export interface ApiConstructProps {
  readonly environment: string;
  readonly pafFunction: lambda.Function;
  readonly awsLocationFunction: lambda.Function;
}

/**
 * API Gateway Construct
 *
 * Creates REST API Gateway with:
 * - /autocomplete/paf endpoint (PAF autocomplete)
 * - /autocomplete/location endpoint (AWS Location Service)
 * - CORS enabled for all origins (POC)
 * - CloudWatch logging enabled
 */
export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // Create CloudWatch Log Group for API Gateway
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: `/aws/apigateway/rapid-address-${props.environment}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create REST API
    this.api = new apigateway.RestApi(this, 'RapidAddressApi', {
      restApiName: `rapid-address-${props.environment}-api`,
      description: 'Rapid Address Service API - Address autocomplete endpoints',
      deployOptions: {
        stageName: props.environment,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: false,
      },
      cloudWatchRole: true,
    });

    // Create /autocomplete resource
    const autocompleteResource = this.api.root.addResource('autocomplete');

    // PAF endpoint: /autocomplete/paf
    const pafResource = autocompleteResource.addResource('paf');
    pafResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.pafFunction, {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
        requestParameters: {
          'method.request.querystring.query': true,
          'method.request.querystring.limit': false,
        },
      }
    );

    // AWS Location endpoint: /autocomplete/location
    const locationResource = autocompleteResource.addResource('location');
    locationResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.awsLocationFunction, {
        proxy: true,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
        requestParameters: {
          'method.request.querystring.query': true,
          'method.request.querystring.limit': false,
          'method.request.querystring.biasPosition': false,
        },
      }
    );
  }
}
