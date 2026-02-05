import { Construct } from 'constructs';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration, Tags } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export interface OpenSearchConstructProps {
  readonly environment: string;
}

/**
 * OpenSearch Serverless Construct
 *
 * Creates an OpenSearch Serverless collection for PAF address indexing:
 * - Encryption security policy (AWS-owned keys)
 * - Network security policy (public access for POC)
 * - OpenSearch Serverless collection (SEARCH type)
 * - Data access policy (created after Lambda role is available)
 * - Index initialization Lambda function
 */
export class OpenSearchConstruct extends Construct {
  public readonly collection: opensearchserverless.CfnCollection;
  public readonly collectionEndpoint: string;
  public readonly collectionArn: string;
  public readonly collectionName: string;
  public readonly initFunction: lambda.Function;
  private readonly environment: string;

  constructor(scope: Construct, id: string, props: OpenSearchConstructProps) {
    super(scope, id);

    this.environment = props.environment;
    this.collectionName = `rapid-address-${props.environment}-paf`;

    // 1. Encryption Security Policy
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'EncryptionPolicy',
      {
        name: `${this.collectionName}-encryption`,
        type: 'encryption',
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${this.collectionName}`],
            },
          ],
          AWSOwnedKey: true,
        }),
      }
    );

    // 2. Network Security Policy
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'NetworkPolicy',
      {
        name: `${this.collectionName}-network`,
        type: 'network',
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: 'collection',
                Resource: [`collection/${this.collectionName}`],
              },
              {
                ResourceType: 'dashboard',
                Resource: [`collection/${this.collectionName}`],
              },
            ],
            AllowFromPublic: true,
          },
        ]),
      }
    );

    // 3. OpenSearch Serverless Collection
    this.collection = new opensearchserverless.CfnCollection(this, 'Collection', {
      name: this.collectionName,
      description: `PAF address search collection for ${props.environment} environment`,
      type: 'SEARCH',
    });

    // Collection depends on security policies
    this.collection.addDependency(encryptionPolicy);
    this.collection.addDependency(networkPolicy);

    // Set collection properties
    this.collectionEndpoint = this.collection.attrCollectionEndpoint;
    this.collectionArn = this.collection.attrArn;

    // 4. Create Index Initialization Lambda
    this.initFunction = new NodejsFunction(this, 'InitFunction', {
      functionName: `rapid-address-${props.environment}-opensearch-init`,
      description: 'Initialize OpenSearch index with PAF mappings',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/opensearch-init/index.ts'),
      memorySize: 256,
      timeout: Duration.seconds(60),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ENVIRONMENT: props.environment,
        OPENSEARCH_ENDPOINT: this.collectionEndpoint,
        OPENSEARCH_INDEX: 'paf-addresses',
        LOG_LEVEL: 'INFO',
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });

    // Grant init Lambda IAM permissions to access OpenSearch Serverless
    this.initFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [this.collectionArn],
      })
    );

    // Add tags
    Tags.of(this.collection).add('Environment', props.environment);
    Tags.of(this.collection).add('Purpose', 'PAF-Address-Search');
    Tags.of(this.initFunction).add('Function', 'OpenSearchInit');
  }

  /**
   * Create data access policies for Lambda roles
   * Creates TWO separate policies following least privilege principle:
   * 1. Read-only policy for PAF Lambda (public-facing API)
   * 2. Read-write policy for Init Lambda (index initialization)
   *
   * Must be called after Lambda functions are created to get the role ARNs
   */
  public createDataAccessPolicy(pafLambdaRoleArn: string, initLambdaRoleArn: string): void {
    // 1. Read-Only Policy for PAF Lambda (public-facing API)
    const readOnlyPolicy = new opensearchserverless.CfnAccessPolicy(
      this,
      'ReadOnlyDataAccessPolicy',
      {
        name: `${this.collectionName}-read-only`,
        type: 'data',
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: 'collection',
                Resource: [`collection/${this.collectionName}`],
                Permission: [
                  'aoss:DescribeCollectionItems',
                ],
              },
              {
                ResourceType: 'index',
                Resource: [`index/${this.collectionName}/*`],
                Permission: [
                  'aoss:DescribeIndex',
                  'aoss:ReadDocument',
                ],
              },
            ],
            Principal: [pafLambdaRoleArn],
          },
        ]),
      }
    );

    // 2. Read-Write Policy for Init Lambda (index initialization)
    const readWritePolicy = new opensearchserverless.CfnAccessPolicy(
      this,
      'ReadWriteDataAccessPolicy',
      {
        name: `${this.collectionName}-read-write`,
        type: 'data',
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: 'collection',
                Resource: [`collection/${this.collectionName}`],
                Permission: [
                  'aoss:CreateCollectionItems',
                  'aoss:UpdateCollectionItems',
                  'aoss:DescribeCollectionItems',
                ],
              },
              {
                ResourceType: 'index',
                Resource: [`index/${this.collectionName}/*`],
                Permission: [
                  'aoss:CreateIndex',
                  'aoss:DescribeIndex',
                  'aoss:ReadDocument',
                  'aoss:WriteDocument',
                  'aoss:UpdateIndex',
                ],
              },
            ],
            Principal: [initLambdaRoleArn],
          },
        ]),
      }
    );

    // Data access policies depend on the collection
    readOnlyPolicy.node.addDependency(this.collection);
    readWritePolicy.node.addDependency(this.collection);
  }
}
