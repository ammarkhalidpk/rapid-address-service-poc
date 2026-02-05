/**
 * Migration Lambda Construct
 *
 * Creates a Lambda function for migrating PAF addresses from SQLite to OpenSearch
 * Features:
 * - 10GB ephemeral storage for SQLite database
 * - 1024 MB memory
 * - 900s timeout (15 minutes)
 * - IAM permissions for S3, OpenSearch, and CloudWatch
 */

import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Duration, Tags, Size } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export interface MigrationLambdaConstructProps {
  readonly environment: string;
  readonly opensearchCollectionEndpoint: string;
  readonly opensearchCollectionArn: string;
  readonly dataBucket: s3.IBucket;
}

/**
 * Migration Lambda Construct
 *
 * Creates a Lambda function for data migration with:
 * - Large ephemeral storage (10GB) for SQLite database
 * - High memory (1024 MB) for batch processing
 * - Extended timeout (900s) for large migrations
 * - Read access to S3 data bucket
 * - Write access to OpenSearch collection
 */
export class MigrationLambdaConstruct extends Construct {
  public readonly migrationFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: MigrationLambdaConstructProps) {
    super(scope, id);

    // Create Migration Lambda function
    this.migrationFunction = new NodejsFunction(this, 'MigrationFunction', {
      functionName: `rapid-address-${props.environment}-data-migration`,
      description: 'Migrate PAF addresses from SQLite to OpenSearch Serverless',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/data-migration/index.ts'),
      memorySize: 1024, // 1 GB for batch processing
      timeout: Duration.seconds(900), // 15 minutes
      ephemeralStorageSize: Size.gibibytes(10), // 10 GB for SQLite database
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ENVIRONMENT: props.environment,
        OPENSEARCH_ENDPOINT: props.opensearchCollectionEndpoint,
        OPENSEARCH_INDEX: 'paf-addresses',
        LOG_LEVEL: 'INFO',
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
        nodeModules: ['better-sqlite3'], // Bundle native module
        commandHooks: {
          // Ensure better-sqlite3 native bindings are included
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          beforeInstall(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
        },
      },
    });

    // Grant read access to data bucket
    props.dataBucket.grantRead(this.migrationFunction);

    // Grant IAM permissions to access OpenSearch Serverless
    this.migrationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [props.opensearchCollectionArn],
      })
    );

    // Add tags
    Tags.of(this.migrationFunction).add('Function', 'DataMigration');
    Tags.of(this.migrationFunction).add('Environment', props.environment);
  }
}
