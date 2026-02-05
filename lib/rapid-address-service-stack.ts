import { Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaConstruct } from './constructs/lambda-construct';
import { ApiConstruct } from './constructs/api-construct';
import { FrontendConstruct } from './constructs/frontend-construct';

export interface RapidAddressServiceStackProps extends StackProps {
  readonly environment: string;
}

/**
 * Rapid Address Service Stack
 *
 * Main CDK stack that orchestrates all infrastructure components:
 * - Lambda functions for PAF and AWS Location autocomplete
 * - API Gateway for RESTful endpoints
 * - S3 + CloudFront for frontend hosting
 */
export class RapidAddressServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: RapidAddressServiceStackProps) {
    super(scope, id, props);

    // Apply stack-level tags
    Tags.of(this).add('Environment', props.environment);
    Tags.of(this).add('Project', 'RapidAddressService');
    Tags.of(this).add('ManagedBy', 'CDK');
    Tags.of(this).add('Purpose', 'POC');

    // Create Lambda functions
    const lambdaConstruct = new LambdaConstruct(this, 'LambdaConstruct', {
      environment: props.environment,
    });

    // Create API Gateway with Lambda integrations
    const apiConstruct = new ApiConstruct(this, 'ApiConstruct', {
      environment: props.environment,
      pafFunction: lambdaConstruct.pafFunction,
      awsLocationFunction: lambdaConstruct.awsLocationFunction,
    });

    // Create Frontend (S3 + CloudFront)
    const frontendConstruct = new FrontendConstruct(this, 'FrontendConstruct', {
      environment: props.environment,
    });

    // Stack Outputs
    new CfnOutput(this, 'CloudFrontDomainName', {
      value: frontendConstruct.cloudFrontDistribution.distributionDomainName,
      description: 'CloudFront distribution domain name for the frontend',
      exportName: `${props.environment}-CloudFrontDomain`,
    });

    new CfnOutput(this, 'CloudFrontDistributionId', {
      value: frontendConstruct.cloudFrontDistribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${props.environment}-CloudFrontDistributionId`,
    });

    new CfnOutput(this, 'FrontendBucketName', {
      value: frontendConstruct.s3Bucket.bucketName,
      description: 'S3 bucket name for frontend assets',
      exportName: `${props.environment}-FrontendBucket`,
    });

    new CfnOutput(this, 'ApiEndpoint', {
      value: apiConstruct.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${props.environment}-ApiEndpoint`,
    });

    new CfnOutput(this, 'PafAutocompleteEndpoint', {
      value: `${apiConstruct.api.url}autocomplete/paf`,
      description: 'PAF autocomplete endpoint',
      exportName: `${props.environment}-PafEndpoint`,
    });

    new CfnOutput(this, 'AwsLocationAutocompleteEndpoint', {
      value: `${apiConstruct.api.url}autocomplete/location`,
      description: 'AWS Location Service autocomplete endpoint',
      exportName: `${props.environment}-LocationEndpoint`,
    });

    new CfnOutput(this, 'PafFunctionName', {
      value: lambdaConstruct.pafFunction.functionName,
      description: 'PAF Lambda function name',
      exportName: `${props.environment}-PafFunctionName`,
    });

    new CfnOutput(this, 'AwsLocationFunctionName', {
      value: lambdaConstruct.awsLocationFunction.functionName,
      description: 'AWS Location Lambda function name',
      exportName: `${props.environment}-LocationFunctionName`,
    });
  }
}
