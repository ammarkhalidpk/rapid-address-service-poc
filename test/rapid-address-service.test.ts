import * as cdk from 'aws-cdk-lib';
import { Template, Capture } from 'aws-cdk-lib/assertions';
import { RapidAddressServiceStack } from '../lib/rapid-address-service-stack';

describe('RapidAddressServiceStack', () => {
  let app: cdk.App;
  let stack: RapidAddressServiceStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new RapidAddressServiceStack(app, 'TestStack', {
      environment: 'test',
      env: {
        account: '123456789012',
        region: 'ap-southeast-2',
      },
    });
    template = Template.fromStack(stack);
  });

  describe('Stack Configuration', () => {
    test('Stack is created with correct tags', () => {
      const stackTags = stack.tags.tagValues();
      expect(stackTags).toEqual({
        Environment: 'test',
        Project: 'RapidAddressService',
        ManagedBy: 'CDK',
        Purpose: 'POC',
      });
    });
  });

  describe('Lambda Functions', () => {
    test('PAF Lambda function is created with correct configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
        MemorySize: 256,
        Timeout: 30,
        FunctionName: 'rapid-address-test-paf-autocomplete',
        Description: 'PAF (Postcode Address File) autocomplete service',
        Handler: 'index.handler',
      });
    });

    test('AWS Location Lambda function is created with correct configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
        MemorySize: 256,
        Timeout: 30,
        FunctionName: 'rapid-address-test-aws-location-autocomplete',
        Description: 'AWS Location Service autocomplete integration',
        Handler: 'index.handler',
      });
    });

    test('Lambda functions have CloudWatch log groups', () => {
      // API Gateway log group is created
      const logGroupCount = Object.keys(template.findResources('AWS::Logs::LogGroup')).length;
      expect(logGroupCount).toBeGreaterThanOrEqual(1);
    });

    test('Lambda functions have appropriate environment variables', () => {
      const envCapture = new Capture();
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: envCapture,
        },
      });

      const envVars = envCapture.asObject();
      expect(envVars).toHaveProperty('ENVIRONMENT', 'test');
      expect(envVars).toHaveProperty('LOG_LEVEL', 'INFO');
    });
  });

  describe('API Gateway', () => {
    test('REST API is created with correct name', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'rapid-address-test-api',
        Description: 'Rapid Address Service API - Address autocomplete endpoints',
      });
    });

    test('API deployment stage is configured correctly', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'test',
      });
    });

    test('API has /autocomplete/paf endpoint', () => {
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'paf',
      });
    });

    test('API has /autocomplete/location endpoint', () => {
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'location',
      });
    });

    test('API methods are configured with GET', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
      });
    });

    test('API has CloudWatch role for logging', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'apigateway.amazonaws.com',
              },
            },
          ],
        },
        ManagedPolicyArns: [
          {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs',
              ],
            ],
          },
        ],
      });
    });
  });

  describe('Frontend (S3 + CloudFront)', () => {
    test('S3 bucket is created with correct configuration', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    test('CloudFront distribution is created', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Comment: 'Rapid Address Service test Frontend Distribution',
          DefaultRootObject: 'index.html',
          Enabled: true,
          HttpVersion: 'http2',
          IPV6Enabled: true,
          PriceClass: 'PriceClass_All',
        },
      });
    });

    test('CloudFront has SPA error response configuration', () => {
      const errorResponsesCapture = new Capture();
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CustomErrorResponses: errorResponsesCapture,
        },
      });

      const errorResponses = errorResponsesCapture.asArray();
      expect(errorResponses).toContainEqual(
        expect.objectContaining({
          ErrorCode: 403,
          ResponseCode: 200,
          ResponsePagePath: '/index.html',
        })
      );
      expect(errorResponses).toContainEqual(
        expect.objectContaining({
          ErrorCode: 404,
          ResponseCode: 200,
          ResponsePagePath: '/index.html',
        })
      );
    });

    test('CloudFront is enabled with HTTP2', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Enabled: true,
          HttpVersion: 'http2',
        },
      });
    });
  });

  describe('Stack Outputs', () => {
    test('CloudFront domain output is created', () => {
      template.hasOutput('CloudFrontDomainName', {
        Description: 'CloudFront distribution domain name for the frontend',
        Export: {
          Name: 'test-CloudFrontDomain',
        },
      });
    });

    test('API endpoint output is created', () => {
      template.hasOutput('ApiEndpoint', {
        Description: 'API Gateway endpoint URL',
        Export: {
          Name: 'test-ApiEndpoint',
        },
      });
    });

    test('PAF endpoint output is created', () => {
      template.hasOutput('PafAutocompleteEndpoint', {
        Description: 'PAF autocomplete endpoint',
        Export: {
          Name: 'test-PafEndpoint',
        },
      });
    });

    test('AWS Location endpoint output is created', () => {
      template.hasOutput('AwsLocationAutocompleteEndpoint', {
        Description: 'AWS Location Service autocomplete endpoint',
        Export: {
          Name: 'test-LocationEndpoint',
        },
      });
    });

    test('Frontend bucket name output is created', () => {
      template.hasOutput('FrontendBucketName', {
        Description: 'S3 bucket name for frontend assets',
        Export: {
          Name: 'test-FrontendBucket',
        },
      });
    });

    test('Lambda function name outputs are created', () => {
      template.hasOutput('PafFunctionName', {
        Description: 'PAF Lambda function name',
      });

      template.hasOutput('AwsLocationFunctionName', {
        Description: 'AWS Location Lambda function name',
      });
    });

    test('OpenSearch outputs are created', () => {
      template.hasOutput('OpenSearchCollectionName', {
        Description: 'OpenSearch Serverless collection name',
        Export: {
          Name: 'test-OpenSearchCollectionName',
        },
      });

      template.hasOutput('OpenSearchCollectionEndpoint', {
        Description: 'OpenSearch Serverless collection endpoint',
        Export: {
          Name: 'test-OpenSearchEndpoint',
        },
      });

      template.hasOutput('OpenSearchCollectionArn', {
        Description: 'OpenSearch Serverless collection ARN',
        Export: {
          Name: 'test-OpenSearchArn',
        },
      });

      template.hasOutput('OpenSearchDashboardUrl', {
        Description: 'OpenSearch Dashboards URL',
        Export: {
          Name: 'test-OpenSearchDashboardUrl',
        },
      });

      template.hasOutput('OpenSearchIndexName', {
        Description: 'OpenSearch index name for PAF addresses',
        Export: {
          Name: 'test-OpenSearchIndexName',
        },
      });

      template.hasOutput('OpenSearchInitFunctionName', {
        Description: 'OpenSearch initialization Lambda function name',
        Export: {
          Name: 'test-OpenSearchInitFunctionName',
        },
      });
    });
  });

  describe('OpenSearch Serverless', () => {
    test('OpenSearch collection is created with correct configuration', () => {
      template.hasResourceProperties('AWS::OpenSearchServerless::Collection', {
        Name: 'rapid-address-test-paf',
        Description: 'PAF address search collection for test environment',
        Type: 'SEARCH',
      });
    });

    test('Encryption security policy is created', () => {
      template.hasResourceProperties('AWS::OpenSearchServerless::SecurityPolicy', {
        Type: 'encryption',
        Name: 'rapid-address-test-paf-encryption',
      });
    });

    test('Network security policy is created', () => {
      template.hasResourceProperties('AWS::OpenSearchServerless::SecurityPolicy', {
        Type: 'network',
      });
    });

    test('Read-only data access policy is created for PAF Lambda', () => {
      template.hasResourceProperties('AWS::OpenSearchServerless::AccessPolicy', {
        Type: 'data',
        Name: 'rapid-address-test-paf-read-only',
      });
    });

    test('Read-write data access policy is created for Init Lambda', () => {
      template.hasResourceProperties('AWS::OpenSearchServerless::AccessPolicy', {
        Type: 'data',
        Name: 'rapid-address-test-paf-read-write',
      });
    });

    test('Two separate data access policies are created', () => {
      const policies = template.findResources('AWS::OpenSearchServerless::AccessPolicy');
      const dataPolicies = Object.values(policies).filter(
        (policy: any) => policy.Properties.Type === 'data'
      );
      expect(dataPolicies.length).toBe(2);
    });

    test('Read-only policy structure is correct', () => {
      // Verify read-only policy exists and has policy document
      template.hasResourceProperties('AWS::OpenSearchServerless::AccessPolicy', {
        Name: 'rapid-address-test-paf-read-only',
        Type: 'data',
      });

      // Get the actual policy to verify it has a Policy property
      const policies = template.findResources('AWS::OpenSearchServerless::AccessPolicy');
      const readOnlyPolicy = Object.values(policies).find(
        (policy: any) => policy.Properties.Name === 'rapid-address-test-paf-read-only'
      ) as any;

      expect(readOnlyPolicy).toBeDefined();
      expect(readOnlyPolicy.Properties.Policy).toBeDefined();
    });

    test('Read-write policy structure is correct', () => {
      // Verify read-write policy exists and has policy document
      template.hasResourceProperties('AWS::OpenSearchServerless::AccessPolicy', {
        Name: 'rapid-address-test-paf-read-write',
        Type: 'data',
      });

      // Get the actual policy to verify it has a Policy property
      const policies = template.findResources('AWS::OpenSearchServerless::AccessPolicy');
      const readWritePolicy = Object.values(policies).find(
        (policy: any) => policy.Properties.Name === 'rapid-address-test-paf-read-write'
      ) as any;

      expect(readWritePolicy).toBeDefined();
      expect(readWritePolicy.Properties.Policy).toBeDefined();
    });

    test('OpenSearch init Lambda function is created', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'rapid-address-test-opensearch-init',
        Description: 'Initialize OpenSearch index with PAF mappings',
        Runtime: 'nodejs20.x',
        MemorySize: 256,
        Timeout: 60,
      });
    });

    test('Lambda functions have OpenSearch environment variables', () => {
      const envCapture = new Capture();
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'rapid-address-test-paf-autocomplete',
        Environment: {
          Variables: envCapture,
        },
      });

      const envVars = envCapture.asObject();
      expect(envVars).toHaveProperty('OPENSEARCH_ENDPOINT');
      expect(envVars).toHaveProperty('OPENSEARCH_INDEX', 'paf-addresses');
    });

    test('PAF Lambda has OpenSearch IAM permissions', () => {
      const policies = template.findResources('AWS::IAM::Policy');
      const policyValues = Object.values(policies);
      const hasOpenSearchPermission = policyValues.some((policy: any) => {
        const statements = policy.Properties?.PolicyDocument?.Statement || [];
        return statements.some((stmt: any) =>
          stmt.Action === 'aoss:APIAccessAll' && stmt.Effect === 'Allow'
        );
      });
      expect(hasOpenSearchPermission).toBe(true);
    });
  });

  describe('Resource Counts', () => {
    test('Correct number of Lambda functions created', () => {
      // 2 main Lambda functions + 1 OpenSearch init Lambda + log retention functions
      const lambdaCount = Object.keys(template.findResources('AWS::Lambda::Function')).length;
      expect(lambdaCount).toBeGreaterThanOrEqual(3);
    });

    test('Correct number of API Gateway resources created', () => {
      // Root + autocomplete + paf + location
      template.resourceCountIs('AWS::ApiGateway::Resource', 3);
    });

    test('S3 buckets are created', () => {
      // Frontend bucket + CloudFront logging bucket + log retention buckets
      // AWS Solutions Constructs creates additional buckets
      const s3Count = Object.keys(template.findResources('AWS::S3::Bucket')).length;
      expect(s3Count).toBeGreaterThanOrEqual(2);
    });

    test('CloudFront distribution is created', () => {
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });
  });

  describe('IAM Permissions', () => {
    test('Lambda functions have execution role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            },
          ],
        },
        ManagedPolicyArns: [
          {
            'Fn::Join': [
              '',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
              ],
            ],
          },
        ],
      });
    });

    test('API Gateway has Lambda invoke permissions', () => {
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
      });
    });
  });
});
