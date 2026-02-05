#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RapidAddressServiceStack } from '../lib/rapid-address-service-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

// Create the stack
new RapidAddressServiceStack(app, 'RapidAddressServiceStack', {
  environment: environment,
  stackName: `rapid-address-${environment}-stack`,
  description: 'Rapid Address Service POC - Address autocomplete infrastructure',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
  },
  tags: {
    Environment: environment,
    Project: 'RapidAddressService',
    ManagedBy: 'CDK',
    Purpose: 'POC',
  },
});

app.synth();
