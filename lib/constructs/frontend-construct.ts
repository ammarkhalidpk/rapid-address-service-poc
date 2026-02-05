import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { CloudFrontToS3 } from '@aws-solutions-constructs/aws-cloudfront-s3';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';

export interface FrontendConstructProps {
  readonly environment: string;
}

/**
 * Frontend Construct
 *
 * Creates S3 bucket with CloudFront distribution for hosting the frontend SPA:
 * - S3 bucket for static website hosting
 * - CloudFront distribution with Origin Access Control (OAC)
 * - SPA routing support (404/403 -> index.html)
 * - Automatic HTTPS with CloudFront certificate
 */
export class FrontendConstruct extends Construct {
  public readonly cloudFrontDistribution: cloudfront.Distribution;
  public readonly s3Bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendConstructProps) {
    super(scope, id);

    // Use AWS Solutions Construct for CloudFront + S3 pattern
    const cloudfrontToS3 = new CloudFrontToS3(this, 'CloudFrontToS3', {
      bucketProps: {
        bucketName: `rapid-address-${props.environment}-frontend`,
        versioned: false,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      },
      cloudFrontDistributionProps: {
        comment: `Rapid Address Service ${props.environment} Frontend Distribution`,
        defaultRootObject: 'index.html',
        priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
        enableLogging: true,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        // SPA routing support - redirect 403/404 to index.html
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: undefined,
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: undefined,
          },
        ],
      },
      insertHttpSecurityHeaders: true,
    });

    this.cloudFrontDistribution = cloudfrontToS3.cloudFrontWebDistribution;
    this.s3Bucket = cloudfrontToS3.s3BucketInterface as s3.Bucket;

    // Add bucket lifecycle rule to clean up old versions (if versioning enabled in future)
    this.s3Bucket.addLifecycleRule({
      id: 'DeleteOldVersions',
      enabled: true,
      noncurrentVersionExpiration: Duration.days(30),
    });
  }
}
