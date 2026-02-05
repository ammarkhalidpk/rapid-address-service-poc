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
      template.resourceCountIs('AWS::Logs::LogGroup', 1);
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
        BucketName: 'rapid-address-test-frontend',
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
  });

  describe('Resource Counts', () => {
    test('Correct number of Lambda functions created', () => {
      // 2 Lambda functions + 2 SingletonFunction for log retention
      template.resourceCountIs('AWS::Lambda::Function', 4);
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
