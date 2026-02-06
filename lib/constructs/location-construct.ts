import { Construct } from 'constructs';
import * as location from 'aws-cdk-lib/aws-location';
import { Tags, Stack } from 'aws-cdk-lib';

export interface LocationConstructProps {
  readonly environment: string;
}

/**
 * Location Construct
 *
 * Creates AWS Location Service resources:
 * - Place Index using Esri data provider for address suggestions
 */
export class LocationConstruct extends Construct {
  public readonly placeIndex: location.CfnPlaceIndex;
  public readonly placeIndexName: string;
  public readonly placeIndexArn: string;

  constructor(scope: Construct, id: string, props: LocationConstructProps) {
    super(scope, id);

    this.placeIndexName = `rapid-address-${props.environment}-place-index`;

    // Create Place Index with Esri data provider
    this.placeIndex = new location.CfnPlaceIndex(this, 'PlaceIndex', {
      indexName: this.placeIndexName,
      dataSource: 'Esri',
      description: 'Place Index for Rapid Address Service - Provides address suggestions using Esri data',
      pricingPlan: 'RequestBasedUsage',
    });

    // Construct ARN for the Place Index
    const stack = Stack.of(this);
    this.placeIndexArn = `arn:aws:geo:${stack.region}:${stack.account}:place-index/${this.placeIndexName}`;

    // Add tags
    Tags.of(this.placeIndex).add('Environment', props.environment);
    Tags.of(this.placeIndex).add('Service', 'LocationService');
    Tags.of(this.placeIndex).add('DataProvider', 'Esri');
  }
}
