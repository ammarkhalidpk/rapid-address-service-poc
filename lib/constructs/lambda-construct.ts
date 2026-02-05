import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Duration, Tags } from 'aws-cdk-lib';
import * as path from 'path';

export interface LambdaConstructProps {
  readonly environment: string;
}

/**
 * Lambda Construct
 *
 * Creates the Lambda functions for the Rapid Address Service:
 * - PAF Autocomplete Function
 * - AWS Location Service Autocomplete Function
 */
export class LambdaConstruct extends Construct {
  public readonly pafFunction: lambda.Function;
  public readonly awsLocationFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ENVIRONMENT: props.environment,
        LOG_LEVEL: 'INFO',
      },
    };

    // PAF Autocomplete Lambda Function
    this.pafFunction = new lambda.Function(this, 'PafAutocompleteFunction', {
      ...commonLambdaProps,
      functionName: `rapid-address-${props.environment}-paf-autocomplete`,
      description: 'PAF (Postcode Address File) autocomplete service',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/paf-autocomplete')),
      handler: 'index.handler',
    });

    // AWS Location Service Autocomplete Lambda Function
    this.awsLocationFunction = new lambda.Function(this, 'AwsLocationAutocompleteFunction', {
      ...commonLambdaProps,
      functionName: `rapid-address-${props.environment}-aws-location-autocomplete`,
      description: 'AWS Location Service autocomplete integration',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/aws-location')),
      handler: 'index.handler',
    });

    // Add tags to Lambda functions
    Tags.of(this.pafFunction).add('Function', 'PafAutocomplete');
    Tags.of(this.awsLocationFunction).add('Function', 'AwsLocationAutocomplete');

    // Future: Add IAM permissions for AWS Location Service
    // this.awsLocationFunction.addToRolePolicy(new iam.PolicyStatement({
    //   actions: ['geo:SearchPlaceIndexForSuggestions'],
    //   resources: ['arn:aws:geo:*:*:place-index/*'],
    // }));
  }
}
