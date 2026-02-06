/**
 * Data Bucket Construct
 *
 * Creates an S3 bucket for storing the SQLite database file
 * used by the data migration Lambda function
 */

import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy, Tags, Duration } from 'aws-cdk-lib';

export interface DataBucketConstructProps {
  readonly environment: string;
}

/**
 * Data Bucket Construct
 *
 * Creates an S3 bucket for storing migration data:
 * - Versioning disabled (large files)
 * - Lifecycle policy to delete old objects after 90 days
 * - Server-side encryption (S3-managed keys)
 * - Block public access
 */
export class DataBucketConstruct extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataBucketConstructProps) {
    super(scope, id);

    // Create S3 bucket for migration data
    // Let CDK auto-generate a unique bucket name to avoid conflicts
    this.bucket = new s3.Bucket(this, 'DataBucket', {
      versioned: false, // Disable versioning for large files
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN, // Retain bucket on stack deletion
      autoDeleteObjects: false, // Don't auto-delete objects
      lifecycleRules: [
        {
          id: 'DeleteOldObjects',
          enabled: true,
          expiration: Duration.days(90),
          noncurrentVersionExpiration: Duration.days(7),
        },
      ],
    });

    // Add tags
    Tags.of(this.bucket).add('Environment', props.environment);
    Tags.of(this.bucket).add('Purpose', 'MigrationData');
  }
}
