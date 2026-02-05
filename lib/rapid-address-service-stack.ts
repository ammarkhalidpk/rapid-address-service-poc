import { Stack, StackProps, CfnOutput, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaConstruct } from './constructs/lambda-construct';
import { ApiConstruct } from './constructs/api-construct';
import { FrontendConstruct } from './constructs/frontend-construct';
import { OpenSearchConstruct } from './constructs/opensearch-construct';

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

    // Create OpenSearch Serverless Collection
    const opensearchConstruct = new OpenSearchConstruct(this, 'OpenSearchConstruct', {
      environment: props.environment,
    });

    // Create Lambda functions with OpenSearch integration
    const lambdaConstruct = new LambdaConstruct(this, 'LambdaConstruct', {
      environment: props.environment,
      opensearchCollectionEndpoint: opensearchConstruct.collectionEndpoint,
      opensearchCollectionArn: opensearchConstruct.collectionArn,
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

    // Create data access policy for Lambda roles to access OpenSearch
    opensearchConstruct.createDataAccessPolicy(
      lambdaConstruct.pafFunction.role!.roleArn,
      opensearchConstruct.initFunction.role!.roleArn
    );

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

    new CfnOutput(this, 'OpenSearchCollectionName', {
      value: opensearchConstruct.collectionName,
      description: 'OpenSearch Serverless collection name',
      exportName: `${props.environment}-OpenSearchCollectionName`,
    });

    new CfnOutput(this, 'OpenSearchCollectionEndpoint', {
      value: opensearchConstruct.collectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
      exportName: `${props.environment}-OpenSearchEndpoint`,
    });

    new CfnOutput(this, 'OpenSearchCollectionArn', {
      value: opensearchConstruct.collectionArn,
      description: 'OpenSearch Serverless collection ARN',
      exportName: `${props.environment}-OpenSearchArn`,
    });

    new CfnOutput(this, 'OpenSearchDashboardUrl', {
      value: `https://${opensearchConstruct.collectionName}.${props.env?.region || 'ap-southeast-2'}.aoss.amazonaws.com/_dashboards`,
      description: 'OpenSearch Dashboards URL',
      exportName: `${props.environment}-OpenSearchDashboardUrl`,
    });

    new CfnOutput(this, 'OpenSearchIndexName', {
      value: 'paf-addresses',
      description: 'OpenSearch index name for PAF addresses',
      exportName: `${props.environment}-OpenSearchIndexName`,
    });

    new CfnOutput(this, 'OpenSearchInitFunctionName', {
      value: opensearchConstruct.initFunction.functionName,
      description: 'OpenSearch initialization Lambda function name',
      exportName: `${props.environment}-OpenSearchInitFunctionName`,
    });
  }
}
