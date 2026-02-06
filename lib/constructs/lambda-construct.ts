import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration, Tags } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export interface LambdaConstructProps {
  readonly environment: string;
  readonly opensearchCollectionEndpoint?: string;
  readonly opensearchCollectionArn?: string;
  readonly placeIndexName?: string;
  readonly placeIndexArn?: string;
}

/**
 * Lambda Construct
 *
 * Creates the Lambda functions for the Rapid Address Service:
 * - PAF Autocomplete Function (NodejsFunction with esbuild bundling)
 * - AWS Location Service Autocomplete Function
 */
export class LambdaConstruct extends Construct {
  public readonly pafFunction: lambda.Function;
  public readonly awsLocationFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    // Common Lambda configuration
    const commonEnvironment: Record<string, string> = {
      ENVIRONMENT: props.environment,
      LOG_LEVEL: 'INFO',
    };

    // Add OpenSearch environment variables if provided
    if (props.opensearchCollectionEndpoint) {
      commonEnvironment.OPENSEARCH_ENDPOINT = props.opensearchCollectionEndpoint;
      commonEnvironment.OPENSEARCH_INDEX = 'paf-addresses';
    }

    // Add Location Service environment variable if provided
    if (props.placeIndexName) {
      commonEnvironment.PLACE_INDEX_NAME = props.placeIndexName;
    }

    // PAF Autocomplete Lambda Function using NodejsFunction for TypeScript bundling
    this.pafFunction = new NodejsFunction(this, 'PafAutocompleteFunction', {
      functionName: `rapid-address-${props.environment}-paf-autocomplete`,
      description: 'PAF (Postcode Address File) autocomplete service',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/paf-autocomplete/index.ts'),
      memorySize: 256,
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnvironment,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });

    // AWS Location Service Autocomplete Lambda Function
    this.awsLocationFunction = new NodejsFunction(this, 'AwsLocationAutocompleteFunction', {
      functionName: `rapid-address-${props.environment}-aws-location-autocomplete`,
      description: 'AWS Location Service autocomplete integration',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/aws-location/index.ts'),
      memorySize: 256,
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnvironment,
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });

    // Add tags to Lambda functions
    Tags.of(this.pafFunction).add('Function', 'PafAutocomplete');
    Tags.of(this.awsLocationFunction).add('Function', 'AwsLocationAutocomplete');

    // Add OpenSearch IAM permissions if collection ARN is provided
    if (props.opensearchCollectionArn) {
      const opensearchPolicy = new iam.PolicyStatement({
        actions: ['aoss:APIAccessAll'],
        resources: [props.opensearchCollectionArn],
      });

      this.pafFunction.addToRolePolicy(opensearchPolicy);
    }

    // Add IAM permissions for AWS Location Service if Place Index ARN is provided
    if (props.placeIndexArn) {
      const locationPolicy = new iam.PolicyStatement({
        actions: ['geo:SearchPlaceIndexForSuggestions'],
        resources: [props.placeIndexArn],
      });

      this.awsLocationFunction.addToRolePolicy(locationPolicy);
    }
  }
}
